const { assert, expect } = require("chai");
const { deployments, ethers, getNamedAccounts, network } = require("hardhat");
const { devChains, networkConfig } = require("../../helper-hardhat.config");

!devChains.includes(network.name)
	? describe.skip
	: describe("Raffle", () => {
			const chainId = network.config.chainId;
			let contract_raffle, contract_vrfCoordinatorV2Mock;
			let entranceFee;
			let interval;

			let deployer;

			beforeEach(async () => {
				deployer = (await getNamedAccounts()).deployer;

				const deploymentResults = await deployments.fixture(["all"]);

				const address_raffle = deploymentResults["Raffle"]?.address;
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
				await contract_raffle.connect(deployer);
				await contract_vrfCoordinatorV2Mock.connect(deployer);
				entranceFee = await contract_raffle.getEntranceFee();
				interval = await contract_raffle.getInterval();
			});

			describe("Constructor:", () => {
				it("Initializes the raffle correctly", async () => {
					// Ideally, one `assert` per `it`
					const raffleState = await contract_raffle.getRaffleState(); // Gets a bigNumber
					assert.equal(raffleState.toString(), "0");
					assert.equal(
						interval.toString(),
						networkConfig[chainId]["interval"],
					);
				});
			});

			describe("Function: `enterRaffle():`", () => {
				it("Reverts if not enough tokens payed.", async () => {
					await expect(
						contract_raffle.enterRaffle(),
					).to.be.revertedWithCustomError(
						contract_raffle,
						"Raffle__NotEnoughETH",
					);
				});

				it("Reverts if contract state is not `OPEN`.", async () => {
					await contract_raffle.enterRaffle({ value: entranceFee });
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
					await contract_raffle.performUpkeep(
						"0x" /**The empty byte array */,
					); // After this, the contract should be in CALCULATING state
					await expect(
						contract_raffle.enterRaffle({ value: entranceFee }),
					).to.be.revertedWithCustomError(
						contract_raffle,
						"Raffle__NotOpen",
					);
				});

				it("Records entered player.", async () => {
					// Entrance fee
					await contract_raffle.enterRaffle({ value: entranceFee });
					// Currently, deployer is connected
					const playerFromRaffle = await contract_raffle.getPlayer(0);
					assert.equal(playerFromRaffle, deployer);
				});

				it("Emits event: `RaffleEnter`.", async () => {
					// Similar to testing error
					await expect(
						contract_raffle.enterRaffle({ value: entranceFee }),
					).to.emit(contract_raffle, "RaffleEnter");
				});
			});

			describe("Function: `checkUpkeep():`", () => {
				// Test every portion, make other portions true
				it("Returns false if the contract state is not `OPEN`", async () => {
					// Player entered and pool has reward
					await contract_raffle.enterRaffle({ value: entranceFee });
					// Time passed true and state is `CALCULATING`
					await network.provider.send("evm_increaseTime", [
						Number(interval) + 1,
					]);
					await network.provider.send("evm_mine", []);

					// Changed state
					await contract_raffle.performUpkeep("0x");

					const raffleState = await contract_raffle.getRaffleState();
					const { upkeepNeeded } =
						await contract_raffle.checkUpkeep.staticCall("0x");
					assert.equal(raffleState.toString(), "1"); // See contract comment for explanation
					assert.equal(upkeepNeeded, false);
				});

				it("Returns false if not enough time passed", async () => {
					// Player and pool
					await contract_raffle.enterRaffle({ value: entranceFee });
					// Is open already
					// Not enough time passed
					await network.provider.send("evm_increaseTime", [
						Number(interval) - 5, // Need to do more than 1 to make sure, tests above may take time
					]);
					await network.provider.send("evm_mine", []);
					const { upkeepNeeded } =
						await contract_raffle.checkUpkeep.staticCall("0x");
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
						await contract_raffle.checkUpkeep.staticCall("0x");
					assert(!upkeepNeeded);
				});

				it("Returns true if has player and reward, enough time passed and state is `OPEN`", async () => {
					// Player and pool
					await contract_raffle.enterRaffle({ value: entranceFee });
					// Is open already
					// Time passed true and state is `CALCULATING`
					await network.provider.send("evm_increaseTime", [
						Number(interval) + 1,
					]);
					await network.provider.send("evm_mine", []);
					const { upkeepNeeded } =
						await contract_raffle.checkUpkeep.staticCall("0x");
					assert(upkeepNeeded);
				});
			});

			describe("Function `performUpkeep():`", () => {
				it("Only runs when `checkUpkeep()` returns `true`.", async () => {
					// Player and pool
					await contract_raffle.enterRaffle({ value: entranceFee });
					// Is open already
					// Time passed true and state is `CALCULATING`
					await network.provider.send("evm_increaseTime", [
						Number(interval) + 1,
					]);
					await network.provider.send("evm_mine", []);

					const txn = await contract_raffle.performUpkeep("0x");
					assert(txn); // If txn didn't go through, this will fail
				});

				it("Reverted with `Raffle__UpkeepNotNeeded` when `checkUpkeep` returns false", async () => {
					// Any case that is false
					// Player and pool
					await contract_raffle.enterRaffle({ value: entranceFee });
					// Is open already
					// Time passed true and state is `CALCULATING`
					await network.provider.send("evm_increaseTime", [
						Number(interval) - 10,
					]);
					await network.provider.send("evm_mine", []);

					await expect(
						contract_raffle.performUpkeep("0x"),
					).to.be.revertedWithCustomError(
						contract_raffle,
						"Raffle__UpkeepNotNeeded",
						/**
						 * Can also add the error params we expect
						 * `Raffle__UpkeepNotNeeded(params)`
						 */
					);
				});

				it("Changes state to `Calculating`", async () => {
					await contract_raffle.enterRaffle({ value: entranceFee });
					// Is open already
					// Time passed true and state is `CALCULATING`
					await network.provider.send("evm_increaseTime", [
						Number(interval) + 1,
					]);
					await network.provider.send("evm_mine", []);

					await contract_raffle.performUpkeep("0x");
					const raffleState = await contract_raffle.getRaffleState();
					assert.equal(raffleState.toString(), "1");
				});

				it("Calls the VRFCoordinator.", async () => {
					await contract_raffle.enterRaffle({ value: entranceFee });
					// Is open already
					// Time passed true and state is `CALCULATING`
					await network.provider.send("evm_increaseTime", [
						Number(interval) + 1,
					]);
					await network.provider.send("evm_mine", []);

					const txnResponse = await contract_raffle.performUpkeep(
						"0x",
					);
					const txnReceipt = await txnResponse.wait(1);

					/**Get request ID
					 * We can get our own event, but we can also get from Mock contract
					 */
					const deployment_raffle = await deployments.get("Raffle"); // Get `Deployment` object of the contract
					const interface_raffle = new ethers.Interface(
						deployment_raffle.abi,
					); // Get ABI from the `Deployment` object
					/**Parse the log
					 *
					 */
					const parsedLogs_raffle = (txnReceipt?.logs || []).map(
						(log) => {
							return interface_raffle.parseLog({
								topics: [...log?.topics] || [],
								data: log?.data || "",
							});
						},
					);

                    console.log(parsedLogs_raffle);
					// Get the param from `parsedLogs`
					const requestId =
						parsedLogs_raffle[1]?.args[0] || BigInt(0);
					
				});
			});
	  });
