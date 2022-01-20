/* eslint-disable camelcase */
/* eslint-disable node/no-missing-import */
import {SignerWithAddress} from "@nomiclabs/hardhat-ethers/signers";
import axios from "axios";
import {assert} from "chai";
import {BigNumber} from "ethers";
import {ethers} from "hardhat";
import {
  SolmateERC20,
  SwapRouter as ISwapRouter,
  SwapRouter__factory,
} from "../../typechain";

const USDC_ADDRESS = "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48";
const WETH_ADDRESS = "0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2";
const UNISWAP_ROUTER_ADDRESS = "0xE592427A0AEce92De3Edee1F18E0157C05861564";

class TestUtils {
  Signer: SignerWithAddress;
  SwapRouter!: ISwapRouter;

  constructor(_signer: SignerWithAddress) {
    this.Signer = _signer;
    this.deploySwapRouter();
  }

  self = () => this.Signer.address;

  getERC20Contract = async (address: string): Promise<SolmateERC20> =>
    (await ethers.getContractAt("SolmateERC20", address)) as SolmateERC20;

  getBalance = async (token: SolmateERC20): Promise<BigNumber> =>
    await token.balanceOf(this.self());

  swapToGetUSDC = async () => {
    const ethBalance = await this.Signer.getBalance();
    const WETH = await ethers.getContractAt(
      "contracts/long-position-handler/src/test/utils/IWETH9.sol:IWETH9",
      WETH_ADDRESS,
    );

    await WETH.connect(this.Signer).deposit({value: ethBalance.div(4)});
    await WETH.connect(this.Signer).approve(
      UNISWAP_ROUTER_ADDRESS,
      WETH.balanceOf(this.self()),
    );

    const UniSwapRouter = await ethers.getContractAt(
      "IUniswapSwapRouter",
      UNISWAP_ROUTER_ADDRESS,
    );

    await UniSwapRouter.connect(this.Signer).exactInputSingle({
      tokenIn: WETH_ADDRESS,
      tokenOut: USDC_ADDRESS,
      fee: 3000,
      recipient: this.self(),
      deadline: 10000000000,
      amountIn: await WETH.balanceOf(this.self()),
      amountOutMinimum: 0,
      sqrtPriceLimitX96: 0,
    });
  };

  deploySwapRouter = async () => {
    const swapRouterFactory = (await ethers.getContractFactory(
      "SwapRouter",
    )) as SwapRouter__factory;
    this.SwapRouter = await swapRouterFactory.deploy(
      "0x1111111254fb6c44bAC0beD2854e76F90643097d",
      "0x220bdA5c8994804Ac96ebe4DF184d25e5c2196D4",
      "0xcd627aa160a6fa45eb793d19ef54f5062f20f33f",
      "0xd962fC30A72A84cE50161031391756Bf2876Af5D",
      "0x9D0464996170c6B9e75eED71c68B99dDEDf279e8",
      "0xbEbc44782C7dB0a1A60Cb6fe97d0b483032FF1C7",
      this.self(),
    );

    await this.SwapRouter.deployed();
  };

  get1inchQuote = async (
    from: string,
    to: string,
    amount: string,
  ): Promise<string | undefined> => {
    const {data, status} = await axios.get(
      `https://api.1inch.io/v4.0/1/swap?fromTokenAddress=${from}&toTokenAddress=${to}&amount=${amount}&fromAddress=${this.SwapRouter.address}&slippage=5&disableEstimate=true`,
    );
    if (status === 200) {
      return data.tx.data;
    }

    assert(false);
  };
}

export default TestUtils;
