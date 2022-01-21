/* eslint-disable camelcase */
/* eslint-disable node/no-missing-import */
import {SignerWithAddress} from "@nomiclabs/hardhat-ethers/signers";
import {assert, expect} from "chai";
import {ethers} from "hardhat";
import {
  IChainlinkAggregatorV3,
  IConvexRewards,
  LongPositionHandler as ILongPositionHandler,
  LongPositionHandler__factory,
  SolmateERC20,
} from "../typechain";
import TestUtils from "./utils";

const USDC_ADDRESS = "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48";

let USDC: SolmateERC20;
let Signer: SignerWithAddress;
let testUtils: TestUtils;

let LongPositionHandler: ILongPositionHandler;

const checkAndRevert = (condition: boolean, a: any, b: any) => {
  assert(condition, `a: ${a} ; b: ${b}`);
};

describe.only("LongPositionHandler", function () {
  before(async () => {
    Signer = (await ethers.getSigners())[0];
    testUtils = new TestUtils(Signer);

    await testUtils.deploySwapRouter();

    const longPositionHandler = (await ethers.getContractFactory(
      "LongPositionHandler",
    )) as LongPositionHandler__factory;

    LongPositionHandler = await longPositionHandler.deploy(
      testUtils.SwapRouter?.address || "",
      "0x3Fe65692bfCD0e6CF84cB1E7d24108E434A7587e",
      "0x8014595F2AB54cD7c604B00E9fb932176fDc86Ae",
      testUtils.self(),
    );
    await LongPositionHandler.deployed();

    USDC = await testUtils.getERC20Contract(USDC_ADDRESS);
    await testUtils.swapToGetUSDC();

    console.log("ETH Bal:", (await Signer.getBalance()).toString());
    console.log("USDC Bal:", (await testUtils.getBalance(USDC)).toString());
  });

  it("should deploy correctly", async () => {
    assert((await LongPositionHandler.governance()) === testUtils.self());
    assert(
      (await LongPositionHandler.baseRewardPool()) ===
        "0x3Fe65692bfCD0e6CF84cB1E7d24108E434A7587e",
    );
    assert(
      (await LongPositionHandler.crvDepositor()) ===
        "0x8014595F2AB54cD7c604B00E9fb932176fDc86Ae",
    );
    assert(
      (await LongPositionHandler.swapRouter()) === testUtils.SwapRouter.address,
    );
  });

  it("should be whitelisted on swapRouter as a handler", async () => {
    expect(
      await testUtils.SwapRouter.positionHandlers(LongPositionHandler.address),
    ).to.eq(false);
    await testUtils.SwapRouter.addPositionHandler(LongPositionHandler.address);
    expect(
      await testUtils.SwapRouter.positionHandlers(LongPositionHandler.address),
    ).to.eq(true);
  });

  it("should deposit correctly", async () => {
    const initialHandlerBalance = await USDC.balanceOf(
      LongPositionHandler.address,
    );
    const initialSignerBalance = await testUtils.getBalance(USDC);
    assert(initialHandlerBalance.eq(0));
    assert(initialSignerBalance.gt(0));

    await USDC.approve(LongPositionHandler.address, initialSignerBalance);
    await LongPositionHandler.deposit(initialSignerBalance);

    const finalSignerBalance = await testUtils.getBalance(USDC);
    const finalHandlerBalance = await USDC.balanceOf(
      LongPositionHandler.address,
    );

    checkAndRevert(
      finalSignerBalance.lt(initialSignerBalance),
      finalSignerBalance,
      initialSignerBalance,
    );
    checkAndRevert(
      finalHandlerBalance.gt(initialHandlerBalance),
      finalHandlerBalance,
      initialHandlerBalance,
    );
  });

  it("should open position correctly", async () => {
    const initialPosition = await LongPositionHandler.positionInUSDC();
    checkAndRevert(initialPosition.eq(0), initialPosition, 0);

    const usdcBal = await USDC.balanceOf(LongPositionHandler.address);
    const swapData = (await testUtils.get1inchSwapData(
      USDC.address,
      await testUtils.SwapRouter.CRV(),
      usdcBal.toString(),
    ))!;

    await LongPositionHandler.openPosition(usdcBal, true, swapData);

    const finalPosition = await LongPositionHandler.positionInUSDC();
    checkAndRevert(
      initialPosition.lt(finalPosition),
      initialPosition,
      finalPosition,
    );
  });

  it("should show position correctly", async () => {
    const crvusdOracle = (await ethers.getContractAt(
      "IChainlinkAggregatorV3",
      "0xCd627aA160A6fA45Eb793D19Ef54f5062F20f33f",
    )) as IChainlinkAggregatorV3;

    const {answer} = await crvusdOracle.latestRoundData();

    const baseRewardPool = (await ethers.getContractAt(
      "IConvexRewards",
      await LongPositionHandler.baseRewardPool(),
    )) as IConvexRewards;

    const stakedCVXCRV = await baseRewardPool.balanceOf(
      LongPositionHandler.address,
    );

    const stakedCVXCRVInUSDC = stakedCVXCRV.mul(answer).div(1e8).toString();
    const positionInUSDC = await LongPositionHandler.positionInUSDC();

    const deviation = Math.abs(
      positionInUSDC
        .sub(stakedCVXCRVInUSDC)
        .mul(100)
        .div(positionInUSDC)
        .toNumber(),
    );

    checkAndRevert(
      deviation < 10,
      stakedCVXCRVInUSDC.toString(),
      positionInUSDC.toString(),
    );
  });

  // it("should ")
});
