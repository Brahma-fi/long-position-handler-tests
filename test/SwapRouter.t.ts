/* eslint-disable camelcase */
/* eslint-disable node/no-missing-import */
import {SignerWithAddress} from "@nomiclabs/hardhat-ethers/signers";
import {expect} from "chai";
// import {expect} from "chai";
import {ethers} from "hardhat";
import {
  SolmateERC20,
  SwapRouter as ISwapRouter,
  SwapRouter__factory,
} from "../typechain";

const USDC_ADDRESS = "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48";
const WETH_ADDRESS = "0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2";
const UNISWAP_ROUTER_ADDRESS = "0xE592427A0AEce92De3Edee1F18E0157C05861564";

let USDC: SolmateERC20;

let Signer: SignerWithAddress;
let SwapRouter: ISwapRouter;

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
    Signer = (await ethers.getSigners())[0];

    const swapRouterFactory = (await ethers.getContractFactory(
      "SwapRouter",
    )) as SwapRouter__factory;
    SwapRouter = await swapRouterFactory.deploy(
      "0x1111111254fb6c44bAC0beD2854e76F90643097d",
      "0x220bdA5c8994804Ac96ebe4DF184d25e5c2196D4",
      "0xcd627aa160a6fa45eb793d19ef54f5062f20f33f",
      "0xd962fC30A72A84cE50161031391756Bf2876Af5D",
      "0x9D0464996170c6B9e75eED71c68B99dDEDf279e8",
      "0xbEbc44782C7dB0a1A60Cb6fe97d0b483032FF1C7",
      Signer.address,
    );

    await SwapRouter.deployed();

    USDC = (await ethers.getContractAt(
      "SolmateERC20",
      USDC_ADDRESS,
    )) as SolmateERC20;
    await swapToGetUSDC();

    console.log("ETH Bal:", (await Signer.getBalance()).toString());
    console.log("USDC Bal:", (await USDC.balanceOf(Signer.address)).toString());
  });

  it("should deploy correctly", async () => {
    expect(await SwapRouter.governance()).to.equal(Signer.address);
  });

  it("should add position handler", async () => {
    expect(await SwapRouter.positionHandlers(Signer.address)).to.equal(false);
    await SwapRouter.connect(Signer).addPositionHandler(Signer.address);
    expect(await SwapRouter.positionHandlers(Signer.address)).to.equal(true);
  });

  it("USDC -> CRV", async function () {
    // await SwapRouter.estimateAndSwapTokens(
    //   true,
    //   SwapRouter.CRV(),
    //   USDC.balanceOf(Signer.address),
    //   Signer.address,
    //   5,
    // );
  });
});
