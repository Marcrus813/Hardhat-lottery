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
                The code now deploys successfully, unsure if works correctly
