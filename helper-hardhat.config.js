const { ethers } = require("hardhat");

const networkConfig = {
	31337: {
		name: "hardhat",
		entranceFee: ethers.parseEther("0.1"),
		gasLane: "", // Mocks anyway
		callbackGasLimit: "500,000",
		interval: "30",
	},
	11155111 /** Sepolia chainId */: {
		name: "Sepolia",
		// ethUsdPriceFeed: "0x694AA1769357215DE4FAC081bf1f309aDC325306",
		vrfCoordinatorV2: "0x8103B0A8A00be2DDC778e6e7eaa21791Cd364625",
		entranceFee: ethers.parseEther("0.01"),
		gasLane:
			"0x474e34a077df58807dbe9c96d3c009b23b3c6d0cce433e59bbf5b34f823bc56c",
		subscriptionId: "2999",
		callbackGasLimit: "500,000",
		interval: "30",
	},
	137 /** Polygon chainId */: {
		name: "Polygon",
		// ethUsdPriceFeed: "0xF9680D99D6C9589e2a93a78A04A279e509205945",
		vrfCoordinatorV2: "0xAE975071Be8F8eE67addBC1A82488F1C24858067",
		entranceFee: ethers.parseEther("0.01"),
		gasLane:
			"0xd729dc84e21ae57ffb6be0053bf2b0668aa2aaf300a2a7b2ddf7dc0bb6e875a8",
		subscriptionId: "2999",
		callbackGasLimit: "500,00",
	},
};

const devChains = ["hardhat", "localhost"];
const MOCK_ARGS = {
	BASE_FEE: ethers.parseEther("0.25"), // See (https://docs.chain.link/vrf/v2/subscription/supported-networks) Sepolia "Premium" 0.25 LINK
	/** Calculated value, based on gas price of the chain
	 *      Chainlink is actually the one paying for the gas to provide randomness and perform execution(e.g., Calling our `checkUpkeep` and `performUpkeep`)
	 *      So this `GAS_PRICE_LINK` ensures the gas we are paying covers what they are paying(LINK per gas)
	 */
	GAS_PRICE_LINK: 1e9, //
};

module.exports = {
	networkConfig,
	devChains,
	MOCK_ARGS,
};
