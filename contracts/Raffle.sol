// SPDX-License-Identifier: MIT
pragma solidity ^0.8.7;

import "@chainlink/contracts/src/v0.8/VRFConsumerBaseV2.sol";
import "@chainlink/contracts/src/v0.8/interfaces/VRFCoordinatorV2Interface.sol";
import "@chainlink/contracts/src/v0.8/AutomationCompatible.sol";

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
error Raffle__NotOpen();
error Raffle__TransferFailed();
error Raffle__UpkeepNotNeeded(
	uint256 currentBalance,
	uint256 playerCount,
	uint256 raffleState
);

/**
 * @title A sample raffle contract
 * @author V
 * @notice This contract is for creating an verifiable random decentralized smart contract
 * @dev This implements Chainlink VRF v2 and Chainlink keepers
 */
contract Raffle is VRFConsumerBaseV2, AutomationCompatibleInterface {
	/** Types */
	enum RaffleState {
		OPEN,
		CALCULATING
	}

	/** State variables */
	uint256 private immutable i_entranceFee;
	/** `address payable[]` initializes address[] that are payable(for the contract will have to pay the players) */
	address payable[] private s_players;
	VRFCoordinatorV2Interface private immutable i_vrfCoordinator;
	bytes32 private immutable i_gasLane;
	uint64 private immutable i_subscriptionId;
	uint16 private constant REQUEST_CONFIRMATIONS = 3;
	uint32 private immutable i_callbackGasLimit;
	uint32 private constant NUM_WORDS = 1;

	/** Lottery variables */
	address private s_recentWinner;
	RaffleState private s_raffleState;
	uint256 private s_lastTimeStamp;
	uint256 private immutable i_interval;

	/** Events */
	// Naming practice: reversed action name(enterRaffle)
	event RaffleEnter(address indexed player);
	event RequestedRaffleWinner(uint256 indexed requestId);
	event WinnerPicked(address indexed winner);

	/**
	 * @dev `VRFConsumerBaseV2` is the constructor for parent contract(class), also called main constructor
	 */
	constructor(
		address vrfCoordinatorV2, // Contract address -> Could use mocks
		uint256 entranceFee,
		bytes32 gasLane,
		uint64 subscriptionId,
		uint32 callbackGasLimit,
		uint256 interval
	) VRFConsumerBaseV2(vrfCoordinatorV2) {
		i_entranceFee = entranceFee;
		i_vrfCoordinator = VRFCoordinatorV2Interface(vrfCoordinatorV2);
		i_gasLane = gasLane;
		i_subscriptionId = subscriptionId;
		i_callbackGasLimit = callbackGasLimit;
		s_raffleState = RaffleState.OPEN; // Can also `RaffleState(0)`
		s_lastTimeStamp = block.timestamp;
		i_interval = interval;
	}

	function enterRaffle() public payable {
		/**
		 * `msg.value` requires payable
		 */
		if (msg.value < i_entranceFee) {
			revert Raffle__NotEnoughETH();
		}

		if (s_raffleState != RaffleState.OPEN) {
			revert Raffle__NotOpen();
		}

		s_players.push(payable(msg.sender));

		/** Events
		 *      Whenever updating a dynamic object(arrays, mappings), we want to emit an event, very important for front end
		 */
		emit RaffleEnter(msg.sender);
	}

	/**
	 * Automation logic
	 * @dev `checkData` Really anything we want with the logic, with `bytes`, we can even call other functions,
	 * 		This is the function that Chainlink keeper nodes call, they look for `upkeepNeeded` to be `true`
	 * 			To return true:
	 * 				1. Time interval should have passed
	 * 				2. At least one player in pool with some ETH
	 * 				3. Subscription needs to be funded with LINK
	 * 				4. Lottery should be in an Open state
	 * 					- Open state when not pending to get random winner, else in Closed state
	 * 					- What if we need multiple states, introduce enums
	 * 						- We will update and check the state when needed
	 * @return upkeepNeeded Check result
	 * @return
	 */
	function checkUpkeep(
		bytes memory /* checkData */
	)
		public
		override
		returns (bool upkeepNeeded, bytes memory /* performData */)
	{
		// Check open state
		bool isOpen = s_raffleState == RaffleState.OPEN;

		/** Check time
		 * 		Solidity: block.timestamp
		 * 			block.timestamp - last block timestamp > interval
		 */
		bool timePassed = (block.timestamp - s_lastTimeStamp) > i_interval;

		// Check enough players
		bool hasPlayers = s_players.length > 0;

		// Check balance
		bool hasBalance = address(this).balance > 0;

		upkeepNeeded = isOpen && timePassed && hasPlayers && hasBalance;
	}

	/**
	 * @dev
	 * Runs automatically
	 *  	Visibility: `external` -> Cheaper and only available to outside this contract
	 *  		See (https://docs.chain.link/vrf/v2/subscription/examples/get-a-random-number) src
	 *  			`requestRandomWords` need to call VRFCoordinator, so we need this as well, imported and tracked above
	 */
	function performUpkeep(bytes calldata /* performData */) external override {
		(bool upkeepNeeded, ) = checkUpkeep("");
		if (!upkeepNeeded) {
			revert Raffle__UpkeepNotNeeded(
				address(this).balance,
				s_players.length,
				uint256(s_raffleState)
			);
		}
		/**
		 * What to do:
		 * 		1. Request the random num
		 * 		2. Get(Fulfill) the random num
		 * 		(Two txns, Reason for this: If only one txn, people can brute simulate calling the txn to try and manipulate the random num)
		 */

		/**
		 * In order to get random num, need these params
		 */
		s_raffleState = RaffleState.CALCULATING; // Preventing entering and updating
		uint256 requestId = i_vrfCoordinator.requestRandomWords( // This function returns a request ID, defining who's requesting
			i_gasLane, // gasLane
			i_subscriptionId, // subscription ID to fund the request
			REQUEST_CONFIRMATIONS,
			i_callbackGasLimit,
			NUM_WORDS
		);

		emit RequestedRaffleWinner(requestId);
	}

	/**
	 * @dev Will be overriding `fulfillRandomWords` from `VRFConsumerBaseV2`, so that VRFCoordinator knows that we can call `fulfillRandomWords`
	 * @dev 		param `requestId` commented to omit `param not used warning without breaking anything`
	 */
	function fulfillRandomWords(
		uint256 /* requestId */,
		uint256[] memory randomWords
	) internal override {
		/*
		 * The random word we get is a big int `2349578612398471289347129478129047129047129471298304` like
		 * 		To match with this, we can use modulo function to get a random num out of player array
		 * 		`s_players` of size 10, random number: 202
		 * 			202 % 10 -> 2, with this we can always get a number between 0 and 9
		 */
		uint256 indexOfWinner = randomWords[0] % s_players.length;
		address payable recentWinner = s_players[indexOfWinner];
		s_recentWinner = recentWinner;
		s_raffleState = RaffleState.OPEN; // Release lock

		s_players = new address payable[](0); // Reset
		s_lastTimeStamp = block.timestamp;

		// Send the money
		(bool success, ) = recentWinner.call{value: address(this).balance}("");
		if (!success) {
			revert Raffle__TransferFailed();
		}

		// To keep track of winners, emit event
		emit WinnerPicked(recentWinner);
	}

	/** View / Pure functions */

	function getEntranceFee() public view returns (uint256) {
		return i_entranceFee;
	}

	function getPlayers(uint256 index) public view returns (address) {
		return s_players[index];
	}

	function getRecentWinner() public view returns (address) {
		return s_recentWinner;
	}

	function getRaffleState() public view returns (RaffleState) {
		return s_raffleState;
	}

	/**
	 * @dev Why can this be restricted to pure?
	 * `NUM_WORDS` is a constant variable, so technically, this is not reading from `storage`
	 */
	function getNumWords() public pure returns (uint256) {
		return NUM_WORDS;
		// return 1; // Basically the same
	}

	function getNumberOfPlayers() public view returns (uint256) {
		return s_players.length;
	}

	function getLatestTimestamp() public view returns (uint256) {
		return s_lastTimeStamp;
	}

	function getRequestConfirmations() public pure returns (uint256) {
		return REQUEST_CONFIRMATIONS;
	}
}
