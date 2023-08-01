// SPDX-License-Identifier: MIT
pragma solidity ^0.8.7;

import "@chainlink/contracts/src/v0.8/VRFConsumerBaseV2.sol";
import "@chainlink/contracts/src/v0.8/interfaces/VRFCoordinatorV2Interface.sol";

/**
 * What we want:
 *      People being able to buy-in
 *      Contract being able to pick a verifiable winner
 *      Winner to be selected automatically
 * What we need:
 *      Chainlink Oracle:
 *          Random
 *      Chainlink keepers
 *          Automation
 */

error Raffle__NotEnoughETH();

contract Raffle is VRFConsumerBaseV2 {
	/** State variables */
	uint256 private immutable i_entranceFee;
	/** `address payable[]` initializes address[] that are payable(for the contract will have to pay the players) */
	address payable[] private s_players;
	VRFCoordinatorV2Interface vrfCoordinator;

	/** Events */
	// Naming practice: reversed action name(enterRaffle)
	event RaffleEnter(address indexed player);

	/**
	 * `VRFConsumerBaseV2` is the constructor for parent contract(class), also called main constructor
	 */
	constructor(
		address vrfCoordinatorV2,
		uint256 entranceFee
	) VRFConsumerBaseV2(vrfCoordinatorV2) {
		i_entranceFee = entranceFee;
		vrfCoordinator = VRFCoordinatorV2Interface(vrfCoordinatorV2); // Timestamp 14:16:53
	}

	function enterRaffle() public payable {
		/**
		 * `msg.value` requires payable
		 */
		if (msg.value < i_entranceFee) {
			revert Raffle__NotEnoughETH();
		}
		s_players.push(payable(msg.sender));

		/** Events
		 *      Whenever updating a dynamic object(arrays, mappings), we want to emit an event, very important for front end
		 */
		emit RaffleEnter(msg.sender);
	}

	/**
	 * Runs automatically
	 * Visibility: `external` -> Cheaper and only available to outside this contract
	 * 		See (https://docs.chain.link/vrf/v2/subscription/examples/get-a-random-number) src
	 * 			`requestRandomWords` need to call VRFCoordinator, so we need this as well, imported and tracked above
	 */
	function requestRandomWinner() external {
		/**
		 * What to do:
		 * 		1. Request the random num
		 * 		2. Get(Fulfill) the random num
		 * 		(Two txns, Reason for this: If only one txn, people can brute simulate calling the txn to try and manipulate the random num)
		 */
	}

	/**
	 * Will be overriding `fulfillRandomWords` from `VRFConsumerBaseV2`, so that VRFCoordinator knows that we can call `fulfillRandomWords`
	 */
	function fulfillRandomWords(
		uint256 requestId,
		uint256[] memory randomWords
	) internal override {}

	/** View / Pure functions */

	function getEntranceFee() public view returns (uint256) {
		return i_entranceFee;
	}

	function getPlayers(uint256 index) public view returns (address) {
		return s_players[index];
	}
}
