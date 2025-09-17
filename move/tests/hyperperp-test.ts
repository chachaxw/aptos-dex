import { expect } from "chai";
import {
  publishMovePackage,
  getTestSigners,
  workspace,
} from "@aptos-labs/workspace";

let packageObjectAddress: string;

describe("hyperperp test", () => {
  let signer;

  it("test the contract", async () => {
    const [signer1] = await getTestSigners();
    signer = signer1;

    // publish the package, getting back the package object address
    packageObjectAddress = await publishMovePackage({
      publisher: signer,
      namedAddresses: {
        hyperperp_addr: signer.accountAddress,
      },
      addressName: "hyperperp_addr",
      packageName: "hyperperp",
    });

    // get the object account modules
    const accountModules = await workspace.getAccountModules({
      accountAddress: packageObjectAddress,
    });
    // expect the account modules to have at least one module
    expect(accountModules).to.have.length.at.least(1);
  });
});
