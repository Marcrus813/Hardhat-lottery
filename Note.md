# Notes

---

## Good practice

-   Do a "What-how" before hand, to help both developing and testing
-   Test-oriented coding
    -   Write test first, code along

---

## Event

-   EVM writes logs(to a special data structure) that can be read, events allow you to print stuff to this log
    -   It is inaccessible for smart contract to read, this is why it's cheaper
    -   Important for front-end
    -   Chainlink relies on this to make API calls, provides random...
-   Basic structure
    > ```solidity
    > event storedNumber(
    > 	uint256 indexed oldNum,
    > 	uint256 indexed newNum,
    > 	uint256 addedNum,
    > 	address sender
    > );
    > ```
    -   Event of type `storedNumber`, when it's emitted, it will have these params
    -   `indexed`
        -   Can have up to 3 `indexed` params, known as `Topics`, these are searchable
        -   Non-indexed are less searchable for being encoded in bytecode
-   Emitting
    > ```solidity
    > emit storedNumber(
    > 	favNum,
    > 	_favNum,
    > 	_favNum + favNum,
    > 	msg.sender
    > );
    > ```
-   Structure of a log
    -   Address of the contract
    -   Name of the event
    -   Topics
    -   Data
        -   Non-indexed

---

## Chainlink VRF

### The request

See [Doc](https://docs.chain.link/vrf/v2/subscription/examples/get-a-random-number)

-   `keyHash` a.k.a `gasLane`
    -   Gas lane key hash: Maximum gas price willing to pay for a request in wei
-   `subscriptionId`
    -   Chainlink subscription id
-   `requestConfirmations`
    -   How many confirmations Chainlink should wait before responding
-   `callbackGasLimit`
    -   Limit for how much gas for callback request to `fulfillRandomWords`, sets a limit for how much computation `fulfillRandomWords` can be, protect from expensive gas
-   `numWords`
    -   How many random num we want

### The fulfill

-   Modulo

---

## Chainlink keepers

-   The contract has to be compatible to

    -   `checkUpkeep`: Checks if the contract requires work to be done
        -   Can also call other functions for having a param of `bytes`(Other advanced functions of `bytes`)
    -   `performUpkeep`: Perform the work, if instructed by `checkUpkeep()`

-   Enums

    -   Custom types with a finite set of `constant values`

-   **Problem notes**
    -   `Raffle.sol:144`, when `checkUpkeep("");`, it gives `Invalid type for argument in function call. Invalid implicit conversion from literal_string "" to bytes calldata requested.solidity(9553)`
        -   In `checkUpkeep` use _memory_ instead of _calldata_: `function checkUpkeep(bytes memory /* checkData */`
            -   `calldata` can only be called from external, hence the function has to be `external`

---

## Deploying

Basically the same as before, `hardhat.config.js`, `helper-hardhat.config.js`, deploy scripts for mocks and contracts, [mock contract](https://github.com/smartcontractkit/chainlink/blob/develop/contracts/src/v0.8/mocks/VRFCoordinatorV2Mock.sol)

-   **Problem notes**
    -   `subscriptionId = txnReceipt.events[0].args.subId;`
        -   Also problem with version, there's no `events` in txnReceipt, there is `logs`
        -   What's still unclear:
            -   New code `subscriptionId = txnReceipt.logs[0].topics[1];`, but in contract `VRFCoordinatorV2Mock`, event `SubscriptionCreated` has event params(topics) of `(uint64 indexed subId, address owner);`, but when debugging, `topics[0]` appears to be an address, while `topics[1]` is `0x000...1` and seems to be `subId`, why is this? There's only one `indexed`, then why is it indexed as `0` and `1`?
                -   The code now deploys successfully, unsure if works correctly

---

## Tests

### Unit test

-   Testing events
    -   [Documentation: Emit Chai Matcher](https://ethereum-waffle.readthedocs.io/en/latest/matchers.html#emitting-events)
-   Hardhat Methods & "Time Travel"
    -   When testing `performUpkeep`, we need to fire `checkUpkeep`, i.e., we need to pretend to be the Chainlink keeper to fire the event upon certain condition, but not necessarily wait that amount of time, this is where "Time travel" comes in, using hardhat, we can make hardhat network perform the way we want, see [Documentation](https://hardhat.org/hardhat-network/reference), what we need here in particular is `evm_increaseTime(): As the name suggests`, `evm_mine(): Mine and create new block`
    -   **Problem notes**
        -   `TypeError: interval.toNumber is not a function`
            -   Ethers.js V6, use `Number(interval)` instead of `toNumber`
-   staticCall

    -   Migrated from `contractName.callStatic.FunctionName()` in V5 to `contractName.FunctionName.staticCall(/*params*/)`
    -   When dealing with `checkUpkeep`, as it's public, if we call it in test, it will be an txn, if it has `view`, then it will return `view`, but in testing, we don't really need to txn, thus use `staticCall` to simulate calling and seeing the result

-   **More on logs, events and topics**

    -   To determine index of `logs[]`, need to go through contracts, see which event is emitted first
    -   To really get the event params, need to use parsing, [example code](https://github.com/satishnvrn/hardhat-lottery-smartcontract-sat/blob/main/deploy/01-deploy-raffle.ts)
    -   [Explanation](https://medium.com/@kaishinaw/ethereum-logs-hands-on-with-ethers-js-a28dde44cbb6)
        -   To answer the problem above, in `topics`, `topics[0]` is the hash of the event: `Event(address, uint256)`, therefore, the get the actual data, we need to decode the raw log data with contract abi(Events are stored as hashes on the blockchain in order to reduce storage requirements)
        -   `Raffle.test.js: 242`, ~~code needs explanation,~~ see `../utils/logParser.js` for explanation
            -   Output of log(`Raffle.sol` emitting `RequestedRaffleWinner`)
                ```json
                [
                    null,
                    LogDescription {
                        fragment: EventFragment {
                        type: 'event',
                        inputs: [Array],
                        name: 'RequestedRaffleWinner',
                        anonymous: false
                        },
                        name: 'RequestedRaffleWinner',
                        signature: 'RequestedRaffleWinner(uint256)',
                        topic: '0xcd6e45c8998311cab7e9d4385596cac867e20a0587194b954fa3a731c93ce78b',
                        args: Result(1) [ 1n ]
                    }
                ]
                ```
                Index 0 should be emitted by `VRFCoordinatorV2Mock`, event: `RandomWordsRequested`, why is it null though?

-   Promising tests
    -   **Problem notes**
        -   When dealing with this, `const txnResponse_performUpkeep = await contract_raffle.performUpkeep("0x");` does not complete, changed to `contract_raffle_player.performUpkeep("0x");`(Where `contract_raffle_player` is a new instance of `contract_raffle` which is connected to a player), then it runs, and it seems all other tests are run on this `contract_raffle_player`. **_STILL NEED EXPLANATION_**
            - Two have the same address(Naturally...)
        -   Always the same address returned, WHY?
            - We are using a Mock in our local environment, we expect the winner to always be the same because the mock doesn't generate randomness. However in a testnet or mainnet, you are guaranteed to get a random winner.
