const { network, ethers, deployments } = require("hardhat");
const { devChains, networkConfig } = require("../helper-hardhat.config");
const { verify } = require("../utils/verify");
const { logParser } = require("../utils/logParser");

module.exports = async (hre) => {
	const { getNamedAccounts } = hre;
	const { deploy, log } = deployments;
	const { deployer } = await getNamedAccounts();

	const chainId = network.config.chainId;

	let address_vrfCoordinatorV2, subscriptionId;
	let vrfCoordinatorV2Mock;

	if (devChains.includes(network.name)) {
		address_vrfCoordinatorV2 = (
			await deployments.get("VRFCoordinatorV2Mock")
		).address;

		vrfCoordinatorV2Mock = await ethers.getContractAt(
			"VRFCoordinatorV2Mock",
			address_vrfCoordinatorV2,
		);

		// Create subscription programmatically
		const txnResponse = await vrfCoordinatorV2Mock.createSubscription();
		const txnReceipt = await txnResponse.wait(1); // An event emitted with a subscription we can get
		const deployment_vrfCoordinatorV2 = await deployments.get(
			"VRFCoordinatorV2Mock",
		);

		const parsedLogs_vrfCoordinatorV2 = logParser(
			deployment_vrfCoordinatorV2,
			txnReceipt,
		);

		subscriptionId = parsedLogs_vrfCoordinatorV2[0]?.args[0] || BigInt(0);

		// Fund subscription
		await vrfCoordinatorV2Mock.fundSubscription(
			subscriptionId,
			ethers.parseEther("30"),
		);
	} else {
		address_vrfCoordinatorV2 = networkConfig[chainId]["vrfCoordinatorV2"];
		subscriptionId = networkConfig[chainId]["subscriptionId"];
		// Can also create and fund subscriptions programmatically
	}

	/** 
     * address vrfCoordinatorV2,
		uint256 entranceFee,
		bytes32 gasLane,
		uint64 subscriptionId,
		uint32 callbackGasLimit,
		uint256 interval
     */

	const entranceFee = networkConfig[chainId]["entranceFee"];
	const gasLane = networkConfig[chainId]["gasLane"];
	// Local subscription id? -> See above
	const callbackGasLimit = networkConfig[chainId]["callbackGasLimit"];
	const interval = networkConfig[chainId]["interval"];

	const raffleArgs = [
		address_vrfCoordinatorV2,
		entranceFee,
		gasLane,
		subscriptionId,
		callbackGasLimit,
		interval,
	];
	const deployOptions_raffle = {
		from: deployer,
		args: raffleArgs,
		log: true,
		waitConfirmations: network.config.blockConfirmations,
	};
	const raffle = await deploy("Raffle", deployOptions_raffle);

	if (devChains.includes(network.name)) {
		await vrfCoordinatorV2Mock.addConsumer(subscriptionId, raffle.address);
	}

	if (!devChains.includes(network.name) && process.env.ETHERSCAN_API_KEY) {
		await verify(raffle.address, raffleArgs);
	}

	console.log("********************************************");
	console.log("*           Deployment complete!           *");
	console.log("********************************************");
	console.log(
		"*********************************************************",
	);
	console.log(`*Deployed at: ${raffle.address}*`);
	console.log(
		"*********************************************************",
	);
};

module.exports.tags = ["all", "Raffle"];
