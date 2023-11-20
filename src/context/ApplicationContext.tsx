"use client";
import React, { useState } from "react";
import { MicroGrantsStrategy } from "@allo-team/allo-v2-sdk/";

import { getIPFSClient } from "@/services/ipfs";
import {
  EProgressStatus,
  ETarget,
  TNewApplication,
  TProgressStep,
} from "@/app/types";
import { sendTransaction } from "@wagmi/core";
import { getChain, wagmiConfigData } from "@/services/wagmi";
import { decodeEventLog } from "viem";
import { MicroGrantsABI } from "@/abi/Microgrants";
import { pollUntilDataIsIndexed } from "@/utils/common";
import { checkIfRecipientIsIndexedQuery } from "@/utils/query";

export interface IApplicationContextProps {
  steps: TProgressStep[];
  createApplication: (
    data: TNewApplication,
    chain: number,
    poolId: number
  ) => Promise<string>;
}

const initialSteps: TProgressStep[] = [
  {
    id: 0,
    content: "Saving your application to ",
    target: ETarget.IPFS,
    href: "",
    status: EProgressStatus.IN_PROGRESS,
  },
  {
    id: 1,
    content: "Registering your application on ",
    target: ETarget.POOL,
    href: "#",
    status: EProgressStatus.NOT_STARTED,
  },
  {
    id: 2,
    content: "Indexing your application",
    target: "",
    href: "",
    status: EProgressStatus.NOT_STARTED,
  },
];

export const ApplicationContext = React.createContext<IApplicationContextProps>(
  {
    steps: initialSteps,
    createApplication: async () => {
      return "";
    },
  }
);

export const ApplicationContextProvider = (props: {
  children: JSX.Element | JSX.Element[];
}) => {
  const [steps, setSteps] = useState<TProgressStep[]>(initialSteps);

  const updateStepTarget = (index: number, target: string) => {
    const newSteps = [...steps];
    newSteps[index].target = target;
    setSteps(newSteps);
  };

  const updateStepStatus = (index: number, status: EProgressStatus) => {
    const newSteps = [...steps];
    newSteps[index].status = status;
    setSteps(newSteps);
  };

  const updateStepHref = (index: number, href: string) => {
    const newSteps = [...steps];
    newSteps[index].href = href;
    setSteps(newSteps);
  };

  const createApplication = async (
    data: TNewApplication,
    chain: number,
    poolId: number
  ): Promise<string> => {
    const chainInfo = getChain(chain);

    updateStepTarget(2, `${chainInfo.name}`);

    // 1. Save metadata to IPFS
    const ipfsClient = getIPFSClient();

    const metadata = {
      name: data.name,
      website: data.website,
      description: data.description,
      email: data.email,
      base64Image: data.base64Image,
      profileOwner: data.profileOwner,
    };

    let imagePointer;
    let pointer;

    try {
      if (metadata.base64Image.includes("base64")) {
        imagePointer = await ipfsClient.pinJSON({
          data: metadata.base64Image,
        });
        metadata.base64Image = imagePointer.IpfsHash;
      }

      pointer = await ipfsClient.pinJSON(metadata);
      updateStepHref(0, "https://ipfs.io/ipfs/" + pointer.IpfsHash);
      updateStepStatus(0, EProgressStatus.IS_SUCCESS);
      updateStepStatus(1, EProgressStatus.IN_PROGRESS);
    } catch (e) {
      console.log("IPFS", e);
      updateStepStatus(0, EProgressStatus.IS_ERROR);
    }

    // 2. Create profile on registry
    // TODO

    // 3. Register application to pool
    let recipientId;

    const strategy = new MicroGrantsStrategy({ chain, poolId });

    const registerRecipientData = strategy.getRegisterRecipientData({
      recipientAddress: data.recipientAddress as `0x${string}`,
      requestedAmount: data.requestedAmount,
      metadata: {
        protocol: BigInt(1),
        pointer: pointer.IpfsHash,
      },
    });

    try {
      const tx = await sendTransaction({
        to: registerRecipientData.to as string,
        data: registerRecipientData.data,
        value: BigInt(1),
      });

      const reciept =
        await wagmiConfigData.publicClient.waitForTransactionReceipt({
          hash: tx.hash,
        });

      const { logs } = reciept;
      const decodedLogs = logs.map((log) =>
        decodeEventLog({ ...log, abi: MicroGrantsABI })
      );

      recipientId = (decodedLogs[0].args as any)["recipientId"];

      console.log("Hash", tx.hash);
      console.log("recipientId", recipientId);

      updateStepTarget(2, `${chainInfo.name} at ${tx.hash}`);
      updateStepHref(
        2,
        `${chainInfo.blockExplorers.default.url}/tx/` + tx.hash
      );

      updateStepStatus(1, EProgressStatus.IS_SUCCESS);
      updateStepStatus(2, EProgressStatus.IN_PROGRESS);
    } catch (e) {
      console.log("Registering Application", e);
      updateStepStatus(1, EProgressStatus.IS_ERROR);
    }

    // 4. Poll indexer for recipientId
    try {
      const pollingData: any = {
        chainId: chain,
        poolId: poolId,
        recipientId: recipientId,
      };
      await pollUntilDataIsIndexed(
        checkIfRecipientIsIndexedQuery,
        pollingData,
        "microGrantRecipient"
      );
      updateStepStatus(2, EProgressStatus.IS_SUCCESS);
    } catch (e) {
      console.log("Polling", e);
      updateStepStatus(2, EProgressStatus.IS_ERROR);
    }

    return recipientId;
  };

  return (
    <ApplicationContext.Provider
      value={{
        steps: steps,
        createApplication: createApplication,
      }}
    >
      {props.children}
    </ApplicationContext.Provider>
  );
};
