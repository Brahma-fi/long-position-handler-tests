/* eslint-disable camelcase */
/* eslint-disable node/no-missing-import */
import {SignerWithAddress} from "@nomiclabs/hardhat-ethers/signers";
import {expect} from "chai";
import {ethers} from "hardhat";
import {
  SolmateERC20,
  SwapRouter as ISwapRouter,
  SwapRouter__factory,
} from "../typechain";
import axios from "axios";
import {assert} from "console";
import {BigNumber} from "ethers";

const USDC_ADDRESS = "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48";
const WETH_ADDRESS = "0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2";
const UNISWAP_ROUTER_ADDRESS = "0xE592427A0AEce92De3Edee1F18E0157C05861564";

let USDC: SolmateERC20;

let Signer: SignerWithAddress;
let SwapRouter: ISwapRouter;

const self = () => Signer.address;

const getERC20Contract = async (address: string): Promise<SolmateERC20> =>
  (await ethers.getContractAt("SolmateERC20", address)) as SolmateERC20;

const getBalance = async (token: SolmateERC20): Promise<BigNumber> =>
  await token.balanceOf(self());

const swapToGetUSDC = async () => {
  const ethBalance = await Signer.getBalance();
  const WETH = await ethers.getContractAt(
    "contracts/long-position-handler/src/test/utils/IWETH9.sol:IWETH9",
    WETH_ADDRESS,
  );

  await WETH.deposit({value: ethBalance.div(4)});
  await WETH.approve(UNISWAP_ROUTER_ADDRESS, WETH.balanceOf(self()));

  const UniSwapRouter = await ethers.getContractAt(
    "IUniswapSwapRouter",
    UNISWAP_ROUTER_ADDRESS,
  );

  await UniSwapRouter.exactInputSingle({
    tokenIn: WETH_ADDRESS,
    tokenOut: USDC_ADDRESS,
    fee: 3000,
    recipient: self(),
    deadline: 10000000000,
    amountIn: await WETH.balanceOf(self()),
    amountOutMinimum: 0,
    sqrtPriceLimitX96: 0,
  });
};

const get1inchQuote = async (
  from: string,
  to: string,
  amount: string,
): Promise<string | undefined> => {
  const {data, status} = await axios.get(
    `https://api.1inch.io/v4.0/1/swap?fromTokenAddress=${from}&toTokenAddress=${to}&amount=${amount}&fromAddress=${SwapRouter.address}&slippage=5&disableEstimate=true`,
  );
  if (status === 200) {
    return data.tx.data;
  }

  assert(false);
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
      self(),
    );

    await SwapRouter.deployed();

    USDC = await getERC20Contract(USDC_ADDRESS);
    await swapToGetUSDC();

    console.log("ETH Bal:", (await Signer.getBalance()).toString());
    console.log("USDC Bal:", (await USDC.balanceOf(self())).toString());
  });

  it("should deploy correctly", async () => {
    expect(await SwapRouter.governance()).to.equal(self());
  });

  it("should add position handler", async () => {
    expect(await SwapRouter.positionHandlers(self())).to.equal(false);
    await SwapRouter.connect(Signer).addPositionHandler(self());
    expect(await SwapRouter.positionHandlers(self())).to.equal(true);
  });

  it("USDC -> CRV", async () => {
    const CRV = await getERC20Contract(await SwapRouter.CRV());
    const usdcBal = await getBalance(USDC);

    expect(usdcBal.toNumber()).to.be.greaterThan(0);
    expect((await getBalance(CRV)).toNumber()).to.equal(0);

    const callData = (await get1inchQuote(
      USDC.address,
      CRV.address,
      usdcBal.toString(),
    ))!;

    USDC.approve(SwapRouter.address, usdcBal);
    await SwapRouter.estimateAndSwapTokens(
      true,
      CRV.address,
      usdcBal,
      self(),
      callData,
    );

    const crvBal = await getBalance(CRV);
    const newUsdcBal = await getBalance(USDC);

    assert(newUsdcBal.lt(usdcBal));
    assert(crvBal.gt(0));
  });

  it("CRV -> CVXCRV", async () => {
    const CRV = await getERC20Contract(await SwapRouter.CRV());
    const CVXCRV = await getERC20Contract(await SwapRouter.CVXCRV());
    const [crvBal, cvxcrvBal] = [
      await CRV.balanceOf(self()),
      await CVXCRV.balanceOf(self()),
    ];

    assert((await getBalance(CRV)).gt(0));
    assert((await getBalance(CVXCRV)).eq(0));

    await CRV.approve(SwapRouter.address, crvBal);
    await SwapRouter.swapOnCRVCVXCRVPool(true, crvBal, self());

    assert((await getBalance(CRV)).lt(crvBal));
    assert((await getBalance(CVXCRV)).gt(cvxcrvBal));
  });

  it("CVXCRV -> USDC", async () => {
    const CVXCRV = await getERC20Contract(await SwapRouter.CVXCRV());
    const usdcBal = await getBalance(USDC);
    const cvxcrvBal = await getBalance(CVXCRV);

    expect((await getBalance(USDC)).toNumber()).to.equal(0);
    assert((await getBalance(CVXCRV)).gt(0));

    const callData = (await get1inchQuote(
      CVXCRV.address,
      USDC.address,
      cvxcrvBal.toString(),
    ))!;

    CVXCRV.approve(SwapRouter.address, cvxcrvBal);
    await SwapRouter.estimateAndSwapTokens(
      false,
      CVXCRV.address,
      cvxcrvBal,
      self(),
      callData,
    );

    const newCvxcrvBal = await getBalance(CVXCRV);
    const newUsdcBal = await getBalance(USDC);

    assert(newCvxcrvBal.lt(cvxcrvBal));
    assert(newUsdcBal.gt(usdcBal));
  });
});
