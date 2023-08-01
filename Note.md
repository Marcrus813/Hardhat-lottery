# Notes

---

## Good practice

- Do a "What-how" before hand, to help both developing and testing
- Test-oriented coding
	- Write test first, code along

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
- Structure of a log
	- Address of the contract
	- Name of the event
	- Topics
	- Data
		- Non-indexed

***

## Chainlink VRF

See [Doc](https://docs.chain.link/vrf/v2/subscription/examples/get-a-random-number)
