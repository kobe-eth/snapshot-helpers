import * as dotenv from "dotenv";
import { BytesLike, ethers } from "ethers";
import * as proposals from "./proposal.json"; // This import style requires "esModuleInterop", see "side notes"
import snapshot from "@snapshot-labs/snapshot.js";
import { request, gql } from 'graphql-request'
import moment from "moment";
import axios from "axios";

const SPACES = ["sdcrv.eth", "sdfxs.eth", "sdangle.eth", "sdbal.eth", "sdpendle.eth"];

dotenv.config();

const extractAddress = (address: string): string => {
  return address.substring(0, 17) + "…" + address.substring(address.length - 2);
}

const getBlockByTimestamp = async (timestamp: number): Promise<number> => {
  const data = await axios.get("https://coins.llama.fi/block/ethereum/" + timestamp);
  return data.data.height;
}

const getCurveGauges = async (): Promise<string[]> => {
  const data = await axios.get("https://api.curve.fi/api/getAllGauges");
  const gaugesMap = data.data.data;

  const response: string[] = [];
  for (const key of Object.keys(gaugesMap)) {
    if (gaugesMap[key].hasNoCrv || gaugesMap[key].is_killed) {
      continue;
    }

    const gauge = gaugesMap[key].gauge as string;
    response.push(key + " - " + extractAddress(gauge));
  }

  return response;
};

const getBalGauges = async (): Promise<string[]> => {
  let data = await axios.get("https://raw.githubusercontent.com/balancer-labs/frontend-v2/master/src/data/voting-gauges.json");
  const gauges = data.data.filter(
    (item: any) =>
      item.network !== 5 && item.network !== 42 && item.isKilled == false,
  );

  const response: string[] = [];
  for (const gauge of gauges) {
    response.push(gauge.pool.symbol + " - " + extractAddress(gauge.address));
  }

  return response;
};

const getAngleGauges = async (): Promise<string[]> => {
  const data = await axios.get("https://api.angle.money/v1/dao");
  const gauges = data.data.gauges.list;

  const response: string[] = [];
  for (const gauge of Object.keys(gauges)) {
    if(gauges[gauge].deprecated) {
      continue;
    }
    response.push(gauges[gauge].name + " - " + extractAddress(gauges[gauge].address));
  }

  return response;
};

const getFraxGauges = async (): Promise<string[]> => {
  const data = await axios.get("https://api.frax.finance/v2/gauges");
  const gauges = data.data.gauges;

  const response: string[] = [];
  for (const gauge of gauges) {
    response.push(gauge.name + " - " + extractAddress(gauge.address));
  }

  return response;
};

const getPendleGauges = async (): Promise<string[]> => {
  const data = await axios.get("https://api-v2.pendle.finance/core/v1/1/markets?limit=20&is_expired=false");
  const gauges = data.data.results;

  const response: string[] = [];
  for (const gauge of gauges) {
    let name = gauge.pt.name;
    if (name.indexOf("PT ") > -1) {
      name = name.replace("PT ", "");
    }
    response.push(name + " - " + gauge.pt.chainId + "-" + gauge.address);
  }

  return response;
};

const getLastGaugeProposal = async (space: string) => {
  const query = gql`{
      proposals(
        where: {
          space: "`+ space + `"
        }
        orderBy: "created"
        orderDirection: desc
      ) {
			  title
			  created
      }
  }`;

  const data = (await request("https://hub.snapshot.org/graphql", query)) as any;
  for (const proposal of data.proposals) {
    if (proposal.title.indexOf("Gauge vote") > -1) {
      return proposal;
    }
  }

  return null;
};

const main = async () => {

  /*const hub = process.env.HUB;

  const client = new snapshot.Client712(hub);
  const pk: BytesLike = process.env.PRIVATE_KEY ? process.env.PRIVATE_KEY : "";

  const signingKey = new ethers.utils.SigningKey(pk);
  const web3 = new ethers.Wallet(signingKey);*/

  const now = moment().unix();
  const day = moment().date();
  const month = moment().month();
  const year = moment().year();

  const blockTimestamp = moment().set('hours', 2).set('minute', 0).set('second', 0).set('millisecond', 0).utc(false).unix()
  const snapshotBlock = await getBlockByTimestamp(blockTimestamp);
  const startProposal = blockTimestamp - 3600;

  for (const space of SPACES) {
    const lastGaugeProposal = await getLastGaugeProposal(space);
    if (!lastGaugeProposal) {
      continue;
    }

    // Check if we are at least 10 days after the last proposal
    // Because all our gauge votes are bi-monthly
    if (lastGaugeProposal.created + (10 * 86400) > now) {
      continue;
    }

    // Fetch gauges corresponding to space
    let gauges: string[] = [];

    switch (space) {
      case "sdcrv.eth":
        gauges = await getCurveGauges();
        break;
      case "sdfxs.eth":
        gauges = await getFraxGauges();
        break;
      case "sdangle.eth":
        gauges = await getAngleGauges();
        break;
      case "sdbal.eth":
        gauges = await getBalGauges();
        break;
      case "sdpendle.eth":
        gauges = await getPendleGauges();
        break;
    }

    if (gauges.length === 0) {
      continue;
    }

    const endProposal = moment().add(space === "sdpendle.eth" ? 27 : 13, 'days');
    const dayEnd = endProposal.date();
    const monthEnd = endProposal.month();
    const yearEnd = endProposal.year();

    const label = space.replace("sd", "").replace(".eth", "").toUpperCase();

    /*await client.proposal(web3, web3.address, {
      space: space,
      type: "weighted",
      title: "Gauge vote " + label + " - " + day + "/" + month + "/" + year + " - " + dayEnd + "/" + monthEnd + "/" + yearEnd,
      body: "Gauge vote for " + label + " inflation allocation.",
      discussion: "https://votemarket.stakedao.org/votes",
      choices: gauges,
      start: startProposal,
      end: startProposal + 4 * 86400, // 4 days after
      snapshot: proposals.payload.snapshot, // 18030841
      plugins: JSON.stringify({}),
    });*/

    console.log({
      space: space,
      type: "weighted",
      title: "Gauge vote " + label + " - " + day + "/" + month + "/" + year + " - " + dayEnd + "/" + monthEnd + "/" + yearEnd,
      body: "Gauge vote for " + label + " inflation allocation.",
      discussion: "https://votemarket.stakedao.org/votes",
      choices: gauges,
      start: startProposal,
      end: startProposal + 4 * 86400 + 86400 / 2, // 4.5 days after
      snapshot: snapshotBlock, // 18030841
      plugins: JSON.stringify({}),
    });
  }
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
