const { assert, expect } = require("chai");
const { deployments, ethers, getNamedAccounts, network } = require("hardhat");
const { devChains, networkConfig } = require("../../helper-hardhat.config");
const { logParser } = require("../../utils/logParser");

!devChains.includes(network.name)
	? describe.skip
	: describe("Raffle", () => {
			const chainId = network.config.chainId;
			let contract_raffle, contract_vrfCoordinatorV2Mock;

			let contract_raffle_player;

			let entranceFee;
			let interval;
			let address_raffle;

			let accounts;
			let deployer;
			let player;

			beforeEach(async () => {
				accounts = await ethers.getSigners();
				deployer = (await getNamedAccounts()).deployer;
				player = accounts[1];

				const deploymentResults = await deployments.fixture(["all"]);

				address_raffle = deploymentResults["Raffle"]?.address;
				contract_raffle = await ethers.getContractAt(
					"Raffle",
					address_raffle,
				);
				const address_vrfCoordinatorV2 =
					deploymentResults["VRFCoordinatorV2Mock"]?.address;
				contract_vrfCoordinatorV2Mock = await ethers.getContractAt(
					"VRFCoordinatorV2Mock",
					address_vrfCoordinatorV2,
				);
				// contract_raffle.connect(deployer);
				contract_raffle_player = contract_raffle.connect(player); // New instance of raffle that is connected to the player
				entranceFee = await contract_raffle_player.getEntranceFee();
				interval = await contract_raffle_player.getInterval();
			});

			describe("Constructor:", () => {
				it("Initializes the raffle correctly", async () => {
					// Ideally, one `assert` per `it`
					const raffleState =
						await contract_raffle_player.getRaffleState(); // Gets a bigNumber
					assert.equal(raffleState.toString(), "0");
					assert.equal(
						interval.toString(),
						networkConfig[chainId]["interval"],
					);
				});
			});

			describe("Function: `enterRaffle()`:", () => {
				it("Reverts if not enough tokens payed.", async () => {
					await expect(
						contract_raffle_player.enterRaffle(),
					).to.be.revertedWithCustomError(
						contract_raffle_player,
						"Raffle__NotEnoughETH",
					);
				});

				it("Reverts if contract state is not `OPEN`.", async () => {
					await contract_raffle_player.enterRaffle({
						value: entranceFee,
					});
					/**
					 * Get the contract to CLOSED state
					 *      Use `performUpkeep` -> Need `checkUpkeep` to be fired
					 */
					await network.provider.send("evm_increaseTime", [
						Number(interval) + 1,
					]); // Calls to time travel to plus 1 of `interval`
					// Update the state
					await network.provider.send("evm_mine", []);

					// Pretend to be a keeper
					await contract_raffle_player.performUpkeep(
						"0x" /**The empty byte array */,
					); // After this, the contract should be in CALCULATING state
					await expect(
						contract_raffle_player.enterRaffle({
							value: entranceFee,
						}),
					).to.be.revertedWithCustomError(
						contract_raffle_player,
						"Raffle__NotOpen",
					);
				});

				it("Records entered player.", async () => {
					// Entrance fee
					await contract_raffle_player.enterRaffle({
						value: entranceFee,
					});
					// Currently, deployer is connected
					const playerFromRaffle =
						await contract_raffle_player.getPlayer(0);
					assert.equal(playerFromRaffle, player.address);
				});

				it("Emits event: `RaffleEnter`.", async () => {
					// Similar to testing error
					await expect(
						contract_raffle_player.enterRaffle({
							value: entranceFee,
						}),
					).to.emit(contract_raffle_player, "RaffleEnter");
				});
			});

			describe("Function: `checkUpkeep()`:", () => {
				// Test every portion, make other portions true
				it("Returns false if the contract state is not `OPEN`", async () => {
					// Player entered and pool has reward
					await contract_raffle_player.enterRaffle({
						value: entranceFee,
					});
					// Time passed true and state is `CALCULATING`
					await network.provider.send("evm_increaseTime", [
						Number(interval) + 1,
					]);
					await network.provider.send("evm_mine", []);

					// Changed state
					await contract_raffle_player.performUpkeep("0x");

					const raffleState =
						await contract_raffle_player.getRaffleState();
					const { upkeepNeeded } =
						await contract_raffle_player.checkUpkeep.staticCall(
							"0x",
						);
					assert.equal(raffleState.toString(), "1"); // See contract comment for explanation
					assert.equal(upkeepNeeded, false);
				});

				it("Returns false if not enough time passed", async () => {
					// Player and pool
					await contract_raffle_player.enterRaffle({
						value: entranceFee,
					});
					// Is open already
					// Not enough time passed
					await network.provider.send("evm_increaseTime", [
						Number(interval) - 5, // Need to do more than 1 to make sure, tests above may take time
					]);
					await network.provider.send("evm_mine", []);
					const { upkeepNeeded } =
						await contract_raffle_player.checkUpkeep.staticCall(
							"0x",
						);
					assert(!upkeepNeeded);
				});

				it("Returns false if no player in the pool", async () => {
					// Time passed: true
					await network.provider.send("evm_increaseTime", [
						Number(interval) + 1,
					]);
					await network.provider.send("evm_mine", []);

					/** staticCall
					 * When dealing with `checkUpkeep`, as it's public, if we call it in test, it will be an txn,
					 * if it has `view`, then it will return `view`, but in testing,
					 * we don't really need to txn, thus use `staticCall` to simulate calling and seeing the result
					 */
					const { upkeepNeeded } =
						await contract_raffle_player.checkUpkeep.staticCall(
							"0x",
						);
					assert(!upkeepNeeded);
				});

				it("Returns true if has player and reward, enough time passed and state is `OPEN`", async () => {
					// Player and pool
					await contract_raffle_player.enterRaffle({
						value: entranceFee,
					});
					// Is open already
					// Time passed true and state is `CALCULATING`
					await network.provider.send("evm_increaseTime", [
						Number(interval) + 1,
					]);
					await network.provider.send("evm_mine", []);
					const { upkeepNeeded } =
						await contract_raffle_player.checkUpkeep.staticCall(
							"0x",
						);
					assert(upkeepNeeded);
				});
			});

			describe("Function `performUpkeep()`:", () => {
				it("Only runs when `checkUpkeep()` returns `true`.", async () => {
					// Player and pool
					await contract_raffle_player.enterRaffle({
						value: entranceFee,
					});
					// Is open already
					// Time passed true and state is `CALCULATING`
					await network.provider.send("evm_increaseTime", [
						Number(interval) + 1,
					]);
					await network.provider.send("evm_mine", []);

					const txn = await contract_raffle_player.performUpkeep(
						"0x",
					);
					assert(txn); // If txn didn't go through, this will fail
				});

				it("Reverted with `Raffle__UpkeepNotNeeded` when `checkUpkeep` returns false", async () => {
					// Any case that is false
					// Player and pool
					await contract_raffle_player.enterRaffle({
						value: entranceFee,
					});
					// Is open already
					// Time passed true and state is `CALCULATING`
					await network.provider.send("evm_increaseTime", [
						Number(interval) - 10,
					]);
					await network.provider.send("evm_mine", []);

					await expect(
						contract_raffle_player.performUpkeep("0x"),
					).to.be.revertedWithCustomError(
						contract_raffle_player,
						"Raffle__UpkeepNotNeeded",
						/**
						 * Can also add the error params we expect
						 * `Raffle__UpkeepNotNeeded(params)`
						 */
					);
				});

				it("Changes state to `Calculating`", async () => {
					await contract_raffle_player.enterRaffle({
						value: entranceFee,
					});
					// Is open already
					// Time passed true and state is `CALCULATING`
					await network.provider.send("evm_increaseTime", [
						Number(interval) + 1,
					]);
					await network.provider.send("evm_mine", []);

					await contract_raffle_player.performUpkeep("0x");
					const raffleState =
						await contract_raffle_player.getRaffleState();
					assert.equal(raffleState.toString(), "1");
				});

				it("Calls the VRFCoordinator.", async () => {
					await contract_raffle_player.enterRaffle({
						value: entranceFee,
					});
					// Is open already
					// Time passed true and state is `CALCULATING`
					await network.provider.send("evm_increaseTime", [
						Number(interval) + 1,
					]);
					await network.provider.send("evm_mine", []);

					const txnResponse =
						await contract_raffle_player.performUpkeep("0x");
					const txnReceipt = await txnResponse.wait(1);

					/**Get request ID
					 * We can get our own event, but we can also get from Mock contract
					 */
					const deployment_raffle = await deployments.get("Raffle"); // Get `Deployment` object of the contract

					const parsedLogs_raffle = logParser(
						deployment_raffle,
						txnReceipt,
					);

					const requestId =
						parsedLogs_raffle[1]?.args[0] || BigInt(0);
					assert(Number(requestId) > 0);
				});
			});

			describe("Function `fulfillRandomWords()`:", () => {
				// For this section, before we test, we defo need players in pool, so add `beforeEach`
				beforeEach(async () => {
					await contract_raffle_player.enterRaffle({
						value: entranceFee,
					});
					await network.provider.send("evm_increaseTime", [
						Number(interval) + 10,
					]);
					await network.provider.send("evm_mine", []);
				});

				it("Can only be called after `performUpkeep`.", async () => {
					/** If called directly without a valid `requestId`(which can only be from a valid `performUpkeep` call)
					 	Expect to be reverted by Mock contract, see code, we need `subId` and `consumerAddress`
					 	Hard coded `requestId` for now*/
					await expect(
						contract_vrfCoordinatorV2Mock.fulfillRandomWords(
							0,
							address_raffle,
						),
					).to.be.revertedWith("nonexistent request"); // The revert msg defined in Mock contract
					await expect(
						contract_vrfCoordinatorV2Mock.fulfillRandomWords(
							1,
							address_raffle,
						),
					).to.be.revertedWith("nonexistent request");
				});

				/**Massive Promise test
				 * The way this test is organized can be applied to staging test
				 *
				 * In this part, we will confirm:
				 * 		Contract picks a winner, resets and sends money
				 * What we will need in addition:
				 * 		More than one player in pool
				 */

				/**What we will do:
				 * 		`performUpkeep`, (We mock being Chainlink keepers) ->
				 * 		`fulfillRandomWords` kicked off(We mock being Chainlink VRF)
				 * 		On test net:
				 * 			Will have to wait for `fulfillRandomWords` to be called
				 * 		On local chain:
				 * 			Don't have to wait, but we need to simulate the waiting
				 * 			Have to setup listener, and make sure the test does not finish until listener listened(Use promise)
				 */
				it("Does what we expect it to do", async () => {
					const additionalPlayersNum = 3;
					const playerAccountIndex = 2; // Deployer is 0
					for (
						let i = playerAccountIndex;
						i < playerAccountIndex + additionalPlayersNum;
						i++
					) {
						contract_raffle_player = await contract_raffle.connect(
							accounts[i],
						);
						await contract_raffle_player.enterRaffle({
							value: entranceFee,
						});
					}

					const startingTimeStamp =
						await contract_raffle_player.getLatestTimestamp();
					const initialBalanceMap = new Map();
					for (let i = 0; i < accounts.length; i++) {
						initialBalanceMap.set(
							accounts[i].address,
							await ethers.provider.getBalance(
								accounts[i].address,
							),
						);
					}

					// This will seem a bit backward going, cuz we need to set up the listener first
					await new Promise(async (resolve, reject) => {
						// Need all codes inside this `Promise` block, but after the `once` block
						// Reject timeout defined in `hardhat.config.js`, if reached timeout and not resolved, this test fails
						contract_raffle_player.once(
							"WinnerPicked" /**Listen for `WinnerPicked` event to be fired */,
							async () => {
								// Once event picked, do this
								try {
									const recentWinner =
										await contract_raffle_player.getRecentWinner();
									const winnerStartingBalance =
										initialBalanceMap.get(recentWinner);
									const winnerEndingBalance =
										await ethers.provider.getBalance(
											recentWinner,
										);
									const raffleState =
										await contract_raffle_player.getRaffleState();
									const endingTimestamp =
										await contract_raffle_player.getLatestTimestamp();

									/**Asserts
									 * State back to open
									 * `s_players` be reset to 0
									 * `s_lastTimestamp` be reset to current time
									 */
									const playerNum =
										await contract_raffle_player.getNumberOfPlayers();
									assert.equal(playerNum.toString(), "0");
									assert.equal(raffleState.toString(), "0");
									assert(endingTimestamp > startingTimeStamp);

									// For operating BigInt, we need to convert all that we don't already know as BigInt to BigInt to avoid exceptions
									assert.equal(
										winnerEndingBalance.toString(),
										(
											winnerStartingBalance +
											BigInt(entranceFee) *
												BigInt(additionalPlayersNum) +
											BigInt(entranceFee)
										).toString(),
									);
								} catch (error) {
									reject();
								}
								resolve();
							},
						);

						const txnResponse_performUpkeep =
							await contract_raffle_player.performUpkeep("0x");
						const txnReceipt_performUpkeep =
							await txnResponse_performUpkeep.wait(1);

						// Get requestId and firing the event
						const deployment_raffle = await deployments.get(
							"Raffle",
						);

						const parsedLogs_raffle = logParser(
							deployment_raffle,
							txnReceipt_performUpkeep,
						);

						const requestId =
							parsedLogs_raffle[1]?.args[0] || BigInt(0);
						await contract_vrfCoordinatorV2Mock.fulfillRandomWords(
							// Once is called, should emit a `WinnerPicked` event
							requestId,
							contract_raffle_player.getAddress(),
						);
					});
				});
			});
	  });
