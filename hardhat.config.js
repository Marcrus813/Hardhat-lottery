require("@nomicfoundation/hardhat-toolbox");
require("dotenv").config();
require("solidity-coverage");
require("hardhat-deploy");
require("hardhat-gas-reporter");
require("hardhat-contract-sizer");
require("@nomicfoundation/hardhat-ethers");

// CN Specific
const { ProxyAgent, setGlobalDispatcher } = require("undici");
const proxyAgent = new ProxyAgent("http://192.168.2.3:10809");
setGlobalDispatcher(proxyAgent);

const RPC_URL_SEPOLIA = process.env.RPC_URL_SEPOLIA || ""; // If `process.env.RPC_URL_SEPOLIA` not exist, then right side, to prevent `undefined`
const PRIV_KEY_SEPOLIA = process.env.PRIV_KEY_SEPOLIA;
const ETHERSCAN_API_KEY = process.env.ETHERSCAN_API_KEY;
const COINMARKETCAP_API_KEY = process.env.COINMARKETCAP_API_KEY;

/** @type import('hardhat/config').HardhatUserConfig */
module.exports = {
	defaultNetwork: "hardhat",
	solidity: {
		compilers: [
			{ version: "0.8.19" },
			{ version: "0.7.7" },
			{ version: "0.6.6" },
		],
	},
	networks: {
		hardhat: {
			blockConfirmations: 0,
		},
		sepolia: {
			url: RPC_URL_SEPOLIA,
			accounts: [PRIV_KEY_SEPOLIA],
			chainId: 11155111,
			blockConfirmations: 5,
		},
		localhost: {
			url: "http://127.0.0.1:8545/",
			chainId: 31337,
			blockConfirmations: 0,
		},
	},
	etherscan: {
		apiKey: ETHERSCAN_API_KEY,
	},
	namedAccounts: {
		deployer: {
			default: 0,
			31337: 0,
		},
		player: { // Separate from deployer
			default: 1,
		},
	},
	gasReporter: {
		enabled: false,
		outputFile: "Gas_Report.txt",
		noColors: true,
		currency: "USD",
		coinmarketcap: COINMARKETCAP_API_KEY,
		token: "ETH",
	},
	mocha: {
		timeout: 300000,
	},
};
