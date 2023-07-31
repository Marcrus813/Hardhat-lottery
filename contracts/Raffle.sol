// SPDX-License-Identifier: MIT
pragma solidity ^0.8.7;

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

contract Raffle {
    uint256 private immutable i_entranceFee;
    /** `address payable[]` initializes address[] that are payable(for the contract will have to pay the players) */
    address payable[] private s_players;

    constructor(uint256 entranceFee) {
        i_entranceFee = entranceFee;
    }

    function enterRaffle() public payable {
        /**
         * `msg.value` requires payable
         */
        if (msg.value < i_entranceFee) {
            revert Raffle__NotEnoughETH();
        }
        s_players.push(payable(msg.sender));

        // Events
        /**
         * Whenever updating a dynamic object(arrays, mappings), we want to emit an event
         */
    }

    // function pickRandomWinner() public returns (address) {}

    function getEntranceFee() public view returns (uint256) {
        return i_entranceFee;
    }

    function getPlayers(uint256 index) public view returns (address) {
        return s_players[index];
    }
}
