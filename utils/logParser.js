const { TransactionReceipt } = require("ethers");
const { ethers } = require("hardhat");

/**
 * Log parser
 * @param {import("hardhat-deploy/dist/types").Deployment} contractDeployment `Deployment object of the contract`
 * @param {TransactionReceipt} txnReceipt txnReceipt of the txn
 * @returns Parsed log object
 */
function logParser(contractDeployment, txnReceipt) {
	const interface = new ethers.Interface(contractDeployment.abi); // Get ABI from the `Deployment` object
	/**Parse the log
	 *
	 */
	const parsedLogs = (txnReceipt?.logs || []).map((log) => {
		// Each `log` object in source array
		return interface.parseLog({
			/**Spread syntax
			 * `[...log?.topics]`: creates a new array by copying all the elements from
			 * the `log?.topics` array into it
			 */
			topics: [...log?.topics] || [],
			data: log?.data || "",
		});
	});
	return parsedLogs;
}

module.exports = { logParser };
