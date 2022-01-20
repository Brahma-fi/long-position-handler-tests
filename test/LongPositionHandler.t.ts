/* eslint-disable camelcase */
/* eslint-disable node/no-missing-import */
import {SignerWithAddress} from "@nomiclabs/hardhat-ethers/signers";
import {assert} from "chai";
import {ethers} from "hardhat";
import {
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
});
