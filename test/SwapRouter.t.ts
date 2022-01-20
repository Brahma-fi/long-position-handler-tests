/* eslint-disable camelcase */
/* eslint-disable node/no-missing-import */
import {SignerWithAddress} from "@nomiclabs/hardhat-ethers/signers";
import {expect} from "chai";
import {ethers} from "hardhat";
import {SolmateERC20} from "../typechain";
import {assert} from "console";
import TestUtils from "./utils";

const USDC_ADDRESS = "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48";

let USDC: SolmateERC20;
let Signer: SignerWithAddress;
let testUtils: TestUtils;

describe("SwapRouter", function () {
  before(async () => {
    Signer = (await ethers.getSigners())[0];
    testUtils = new TestUtils(Signer);

    await testUtils.deploySwapRouter();

    USDC = await testUtils.getERC20Contract(USDC_ADDRESS);
    await testUtils.swapToGetUSDC();

    console.log("ETH Bal:", (await Signer.getBalance()).toString());
    console.log("USDC Bal:", (await testUtils.getBalance(USDC)).toString());
  });

  it("should deploy correctly", async () => {
    expect(await testUtils.SwapRouter.governance()).to.equal(testUtils.self());
  });

  it("should add position handler", async () => {
    expect(
      await testUtils.SwapRouter.positionHandlers(testUtils.self()),
    ).to.equal(false);
    await testUtils.SwapRouter.connect(Signer).addPositionHandler(
      testUtils.self(),
    );
    expect(
      await testUtils.SwapRouter.positionHandlers(testUtils.self()),
    ).to.equal(true);
  });

  it("USDC -> CRV", async () => {
    const CRV = await testUtils.getERC20Contract(
      await testUtils.SwapRouter.CRV(),
    );
    const usdcBal = await testUtils.getBalance(USDC);

    expect(usdcBal.toNumber()).to.be.greaterThan(0);
    expect((await testUtils.getBalance(CRV)).toNumber()).to.equal(0);

    const callData = (await testUtils.get1inchQuote(
      USDC.address,
      CRV.address,
      usdcBal.toString(),
    ))!;

    USDC.approve(testUtils.SwapRouter.address, usdcBal);
    await testUtils.SwapRouter.estimateAndSwapTokens(
      true,
      CRV.address,
      usdcBal,
      testUtils.self(),
      callData,
    );

    const crvBal = await testUtils.getBalance(CRV);
    const newUsdcBal = await testUtils.getBalance(USDC);

    assert(newUsdcBal.lt(usdcBal));
    assert(crvBal.gt(0));
  });

  it("CRV -> CVXCRV", async () => {
    const CRV = await testUtils.getERC20Contract(
      await testUtils.SwapRouter.CRV(),
    );
    const CVXCRV = await testUtils.getERC20Contract(
      await testUtils.SwapRouter.CVXCRV(),
    );
    const [crvBal, cvxcrvBal] = [
      await CRV.balanceOf(testUtils.self()),
      await CVXCRV.balanceOf(testUtils.self()),
    ];

    assert((await testUtils.getBalance(CRV)).gt(0));
    assert((await testUtils.getBalance(CVXCRV)).eq(0));

    await CRV.approve(testUtils.SwapRouter.address, crvBal);
    await testUtils.SwapRouter.swapOnCRVCVXCRVPool(
      true,
      crvBal,
      testUtils.self(),
    );

    assert((await testUtils.getBalance(CRV)).lt(crvBal));
    assert((await testUtils.getBalance(CVXCRV)).gt(cvxcrvBal));
  });

  it("CVXCRV -> USDC", async () => {
    const CVXCRV = await testUtils.getERC20Contract(
      await testUtils.SwapRouter.CVXCRV(),
    );
    const usdcBal = await testUtils.getBalance(USDC);
    const cvxcrvBal = await testUtils.getBalance(CVXCRV);

    expect((await testUtils.getBalance(USDC)).toNumber()).to.equal(0);
    assert((await testUtils.getBalance(CVXCRV)).gt(0));

    const callData = (await testUtils.get1inchQuote(
      CVXCRV.address,
      USDC.address,
      cvxcrvBal.toString(),
    ))!;

    CVXCRV.approve(testUtils.SwapRouter.address, cvxcrvBal);
    await testUtils.SwapRouter.estimateAndSwapTokens(
      false,
      CVXCRV.address,
      cvxcrvBal,
      testUtils.self(),
      callData,
    );

    const newCvxcrvBal = await testUtils.getBalance(CVXCRV);
    const newUsdcBal = await testUtils.getBalance(USDC);

    assert(newCvxcrvBal.lt(cvxcrvBal));
    assert(newUsdcBal.gt(usdcBal));
  });
});
