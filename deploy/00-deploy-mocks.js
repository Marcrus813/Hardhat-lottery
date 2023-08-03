const { devChains, MOCK_ARGS } = require("../helper-hardhat.config");

module.exports = async (hre) => {
	const { getNamedAccounts, deployments } = hre;
	const { deploy, log } = deployments;
	const { deployer } = await getNamedAccounts();

	const chainId = network.config.chainId;

	console.log(`Detected network: ${network.name}`);

	if (devChains.includes(network.name)) {
		console.log("********************************************");
		console.log("*Local network detected, deploying mocks...*");
		console.log("********************************************");

		await deploy("VRFCoordinatorV2Mock", {
			contract: "VRFCoordinatorV2Mock",
			from: deployer,
			log: true,
			args: [MOCK_ARGS["BASE_FEE"], MOCK_ARGS["GAS_PRICE_LINK"]],
		});

        console.log("********************************************");
		console.log("*            Mocks deployed!               *");
		console.log("********************************************");
	}
};

module.exports.tags = ["all", "mocks"];
