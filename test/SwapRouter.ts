/* eslint-disable node/no-missing-import */
import {SignerWithAddress} from "@nomiclabs/hardhat-ethers/signers";
// import {expect} from "chai";
import {ethers} from "hardhat";
import {SolmateERC20} from "../typechain";
// import {SwapRouter__factory} from "../typechain";

const USDC_ADDRESS = "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48";
const WETH_ADDRESS = "0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2";
const UNISWAP_ROUTER_ADDRESS = "0xE592427A0AEce92De3Edee1F18E0157C05861564";

let USDC: SolmateERC20;
let Signer: SignerWithAddress;
// let SwapRouter: SwapRouter__factory;

const swapToGetUSDC = async () => {
  const ethBalance = await Signer.getBalance();
  const WETH = await ethers.getContractAt(
    "contracts/long-position-handler/src/test/utils/IWETH9.sol:IWETH9",
    WETH_ADDRESS,
  );

  await WETH.deposit({value: ethBalance.div(4)});
  await WETH.approve(UNISWAP_ROUTER_ADDRESS, WETH.balanceOf(Signer.address));

  const UniSwapRouter = await ethers.getContractAt(
    "IUniswapSwapRouter",
    UNISWAP_ROUTER_ADDRESS,
  );

  await UniSwapRouter.exactInputSingle({
    tokenIn: WETH_ADDRESS,
    tokenOut: USDC_ADDRESS,
    fee: 3000,
    recipient: Signer.address,
    deadline: 10000000000,
    amountIn: await WETH.balanceOf(Signer.address),
    amountOutMinimum: 0,
    sqrtPriceLimitX96: 0,
  });
};

describe("SwapRouter", function () {
  before(async () => {
    // SwapRouter = await ethers.getContractFactory("SwapRouter");
    USDC = await ethers.getContractAt("SolmateERC20", USDC_ADDRESS);
    Signer = (await ethers.getSigners())[0];

    await swapToGetUSDC();

    console.log("ETH Bal:", (await Signer.getBalance()).toString());
    console.log("USDC Bal:", (await USDC.balanceOf(Signer.address)).toString());
  });

  it("USDC -> CRV", async function () {});
});
