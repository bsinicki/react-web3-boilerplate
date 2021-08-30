import * as React from "react";
import styled from "styled-components";
import {
  OrderSide,
  OrderJSON,
  OpenSeaAsset,
  Order,
} from "opensea-js/lib/types";
// import BigNumber from "bignumber.js";
import { Container, Row, Col, Card, Button, Table, } from "react-bootstrap";
import "bootstrap/dist/css/bootstrap.min.css";
import axios from 'axios';

import Web3Modal from "web3modal";
// @ts-ignore
import WalletConnectProvider from "@walletconnect/web3-provider";
import Column from "./components/Column";
import Wrapper from "./components/Wrapper";
import Header from "./components/Header";
import Loader from "./components/Loader";
import ConnectButton from "./components/ConnectButton";
import { OpenSeaPort, Network } from "opensea-js";
const Web3Utils = require("web3-utils");

import { Web3Provider } from "@ethersproject/providers";
import { getChainData } from "./helpers/utilities";

// let seaport:any;
// let itemInfo = "";
// let userBalanceOfAsset:any = 0;
const asset = {
  tokenAddress: "0x318f9bfb761d6e3cb95a270c48dd532637783715", // Uniq Collections
  tokenId: "6", // Token ID
};

const SLayout = styled.div`
  position: relative;
  width: 100%;
  max-width: 2000px;
  text-align: center;
`;

const SContent = styled(Wrapper)`
  width: 100%;
  padding: 0 16px;
  max-width: 2000px;
`;

const SContainer = styled.div`
  height: 100%;
  min-height: 200px;
  max-width: 2000px;
`;

const SLanding = styled(Column)`
  max-width: 2000px;
  text-align: left;
`;

// @ts-ignore
const SBalances = styled(SLanding)`
  height: 100%;
  & h3 {
    padding-top: 30px;
  }
`;

type tOrders = OrderJSON[];

interface IAppState {
  fetching: boolean;
  address: string;
  library: any;
  connected: boolean;
  chainId: number;
  pendingRequest: boolean;
  result: any | null;
  electionContract: any | null;
  asset: OpenSeaAsset | null;
  info: any | null;
  name: string | null;
  image: string;
  isItemOwner: boolean | null;
  orders: tOrders | any;
  seaport: OpenSeaPort | undefined;
  events: Object[] | null;
}

const INITIAL_STATE: IAppState = {
  fetching: false,
  address: "",
  library: null,
  connected: false,
  chainId: 1,
  pendingRequest: false,
  result: null,
  electionContract: null,
  asset: null,
  info: null,
  name: "",
  image:
    "https://lh3.googleusercontent.com/DBD8vFv2QZ-ZrJ4jKH2lVwrJxiw4qFw2ntwmT6Ly_MrXoc4HLjZleHprxpfSCPX6_Sw7h-rIFVJ8zluRKqWtFnbvk04NU8nUsxUHdg=s128",
  isItemOwner: null,
  seaport: undefined,
  orders: [],
  events: null
};

class App extends React.Component<any, any> {
  // @ts-ignore
  public web3Modal: Web3Modal;
  public state: IAppState;
  public provider: any;

  constructor(props: any) {
    super(props);
    this.state = {
      ...INITIAL_STATE,
    };

    this.web3Modal = new Web3Modal({
      network: this.getNetwork(),
      cacheProvider: true,
      providerOptions: this.getProviderOptions(),
    });
  }

  public componentDidMount() {
    if (this.web3Modal.cachedProvider) {
      this.onConnect();
    }
  }

  public onConnect = async () => {
    this.provider = await this.web3Modal.connect();

    const library = new Web3Provider(this.provider);

    const network = await library.getNetwork();

    const address = this.provider.selectedAddress
      ? this.provider.selectedAddress
      : this.provider?.accounts[0];

    await this.setState({
      library,
      chainId: network.chainId,
      address,
      connected: true,
    });

    await this.setState({
      seaport: new OpenSeaPort(this.provider, {
        networkName: Network.Rinkeby,
        // apiKey: "d04ef1aac0f74bfba1ef609cc3a7a5a3",
      }),
    });

    await this.subscribeToProviderEvents(this.provider);
    await this.getOSItem();
  };

  public getOSItem = async () => {
    const address = this.provider.selectedAddress
      ? this.provider.selectedAddress
      : this.provider?.accounts[0];

    const itemInfo = await this.state.seaport!.api.getAsset(asset);
    await this.setState({ asset: itemInfo });

    await this.setState({ name: itemInfo.name });
    await this.setState({ image: itemInfo.imageUrl });

    const isOwner = itemInfo.owner.address === address;

    await this.setState({ isItemOwner: isOwner });

    console.log(this.state.asset);

    await this.getEvents();
  };

  public getAssets = async () => {
    let assetsInfo = {};
    for (let i = 0; i < 5; i++) {
      assetsInfo = this.state.seaport!.api.getAssets({
        asset_contract_address: asset.tokenAddress,
        order_by: "sale_price",
        order_direction: "desc",
        limit: 30 + i,
        offset: 0,
      });
      console.log(i + " " + assetsInfo);
    }
  };

  public getSellOrders = async () => {
    const arr = Array.from({ length: 30 }, (v, k) => k + 1);

    const { orders } = await this.state.seaport!.api.getOrders(
      {
        asset_contract_address: asset.tokenAddress,
        token_ids: arr,
        offset: 0,
        limit: 20,
      },
      1
    );

    console.log(orders);

    await this.setState({ orders: this.state.orders.concat(orders) });
  };

  public getBuyOrders = async () => {
    const { orders } = await this.state.seaport!.api.getOrders({
      asset_contract_address: asset.tokenAddress,
      token_id: asset.tokenId,
      side: OrderSide.Buy,
    });

    await this.setState({ orders: this.state.orders.concat(orders) });

    console.log(this.state.orders);
  };

  public createOffer = async () => {
    const address = this.provider.selectedAddress
      ? this.provider.selectedAddress
      : this.provider?.accounts[0];

    const offer = await this.state.seaport!.createBuyOrder({
      asset,
      accountAddress: address,
      startAmount: 0.75,
    });

    console.log(offer);
  };

  public buyNow = async () => {
    const address = this.provider.selectedAddress
      ? this.provider.selectedAddress
      : this.provider?.accounts[0];

    const order: Order = this.state.asset?.sellOrders?.[0]!;

    const transactionHash = await await this.state.seaport!.fulfillOrder({
      order,
      accountAddress: address,
    });

    console.log(transactionHash);
  };

  public getEvents  = async ()  => {
    let res:any = [];
    await axios.get('https://api.opensea.io/api/v1/events', {
      params: {
        asset_contract_address: asset.tokenAddress,
        token_id:  asset.tokenId,
        only_opensea: false,
        offset:0,
        limit:250
      }
    })
      .then(function (response: any) {
        res = response;
      })
      .catch(function (error: any) {
        console.log(error);
      })
      .then(function () {
      });
      await this.setState({ events: res.data.asset_events });
      console.log(this.state.events)
  }

  public sellItemOnOpenSea = async () => {
    const address = this.provider.selectedAddress
      ? this.provider.selectedAddress
      : this.provider?.accounts[0];

    const expirationTime = Math.round(Date.now() / 1000 + 60 * 60 * 24);

    const listing = await this.state.seaport!.createSellOrder({
      asset,
      accountAddress: address,
      startAmount: 0.75,
      expirationTime,
      paymentTokenAddress: "0xc778417e063141139fce010982780140aa0cd5ab",
    });

    console.log(listing);
  };

  public subscribeToProviderEvents = async (provider: any) => {
    if (!provider.on) {
      return;
    }

    provider.on("accountsChanged", this.changedAccount);
    provider.on("networkChanged", this.networkChanged);
    provider.on("close", this.close);

    await this.web3Modal.off("accountsChanged");
  };

  public async unSubscribe(provider: any) {
    // Workaround for metamask widget > 9.0.3 (provider.off is undefined);
    window.location.reload(false);
    if (!provider.off) {
      return;
    }

    provider.off("accountsChanged", this.changedAccount);
    provider.off("networkChanged", this.networkChanged);
    provider.off("close", this.close);
  }

  public changedAccount = async (accounts: string[]) => {
    if (!accounts.length) {
      // Metamask Lock fire an empty accounts array
      await this.resetApp();
    } else {
      await this.setState({ address: accounts[0] });
      await this.getOSItem();
    }
  };

  public networkChanged = async (networkId: number) => {
    const library = new Web3Provider(this.provider);
    const network = await library.getNetwork();
    const chainId = network.chainId;
    await this.setState({ chainId, library });
  };

  public close = async () => {
    this.resetApp();
  };

  public getNetwork = () => getChainData(this.state.chainId).network;

  public getProviderOptions = () => {
    const providerOptions = {
      walletconnect: {
        package: WalletConnectProvider,
        options: {
          infuraId: process.env.REACT_APP_INFURA_ID,
        },
      },
    };
    return providerOptions;
  };

  public resetApp = async () => {
    await this.web3Modal.clearCachedProvider();
    localStorage.removeItem("WEB3_CONNECT_CACHED_PROVIDER");
    localStorage.removeItem("walletconnect");
    await this.unSubscribe(this.provider);

    this.setState({ ...INITIAL_STATE });
  };

  public render = () => {
    const { address, connected, chainId, fetching } = this.state;
    return (
      <SLayout>
        <Column maxWidth={2000} spanHeight>
          <Header
            connected={connected}
            address={address}
            chainId={chainId}
            killSession={this.resetApp}
          />
          <SContent>
            {fetching ? (
              <Column center>
                <SContainer>
                  <Loader />
                </SContainer>
              </Column>
            ) : (
              <SLanding center>
                <Row>
                  <Col>
                    {!this.state.connected && (
                      <ConnectButton onClick={this.onConnect} />
                    )}
                  </Col>
                </Row>

                {this.state.asset && (
                  <Container>
                    <Row>
                      <Col>
                        {/* Image */}
                        <img src={this.state.asset.imageUrl} />
                      </Col>
                      <Col>
                        {/* Collection name */}
                        <div>
                          <b>{this.state.asset.collection.name}</b>
                        </div>

                        {/* Asset name */}
                        <h3 onClick={this.getAssets}>
                          {this.state.asset.name}
                        </h3>

                        {/* Owner */}
                        {this.state.isItemOwner ? (
                          <div>You're owner of this item</div>
                        ) : (
                          <div>Owner is {this.state.asset.owner.address}</div>
                        )}

                        {/* CLEAR*/}
                         {!this.state.asset.sellOrders![0] && !this.state.asset.buyOrders![0] && (
                        <Card>
                          <Card.Header as="h5">No offers</Card.Header>
                          <Card.Body>
                            <Button variant="primary" onClick={this.createOffer}>Create Offer</Button>
                          </Card.Body>
                        </Card>
                          )}

                        
                        {/* BUY NOW */}
                        {this.state.asset.sellOrders &&
                          this.state.asset.sellOrders[0] && (
                        <Card>
                          <Card.Header as="h5">{this.state.asset.sellOrders![0].waitingForBestCounterOrder ? ((Math.max.apply(Math, this.state.asset!.buyOrders!.map(function(o) { return o.basePrice; })) > this.state.asset.sellOrders![0].currentPrice!) ? "Maximum bid" : "Minimum bid") : "Current Price"}</Card.Header>
                          <Card.Body>
                            <Card.Title>{((Math.max.apply(Math, this.state.asset!.buyOrders!.map(function(o) { return o.basePrice; })) > Math.min.apply(Math, this.state.asset!.sellOrders!.map(function(o) { return o.currentPrice; }))) ? Web3Utils.fromWei(Math.max.apply(Math, this.state.asset!.buyOrders!.map(function(o) { return o.basePrice; })).toString(),"ether"):Web3Utils.fromWei(Math.min.apply(Math, this.state.asset!.sellOrders!.map(function(o) { return o.currentPrice; })).toString(),"ether")) } ETH</Card.Title>
                            {this.state.asset!.sellOrders![0].expirationTime.greaterThan(0) && (<Card.Text>
                                  Expiration Date: {(new Date(this.state.asset!.sellOrders![0].expirationTime.mul(1000).toNumber())).toString()}
                             </Card.Text>)}

                             {this.state.asset!.sellOrders![0].expirationTime && this.state.asset!.sellOrders![0].extra.greaterThan(0) && (<Card.Text>
                              Price goes down from {Web3Utils.fromWei(this.state.asset!.sellOrders![0].basePrice!.toString(), "ether")} to {Web3Utils.fromWei(this.state.asset!.sellOrders![0].extra!.toString(), "ether")} ETH 
                             </Card.Text>)}

                            <Button variant="primary m-2" onClick={this.buyNow}>Buy now</Button>
                            <Button variant="secondary" onClick={this.createOffer}>Create Offer</Button>
                          </Card.Body>
                        </Card>
                          )}

                        {/* HIGHEST OFFER */}
                        {!this.state.asset.sellOrders![0] && this.state.asset.buyOrders &&
                          this.state.asset.buyOrders[0] && (
                        <Card>
                          <Card.Header as="h5">Highest offer</Card.Header>
                          <Card.Body>
                            <Card.Title>{Web3Utils.fromWei(Math.max.apply(Math, this.state.asset!.buyOrders!.map(function(o) { return o.basePrice; })).toString(), "ether")} ETH</Card.Title>
                            <Button variant="secondary" onClick={this.createOffer}>Create Offer</Button>
                          </Card.Body>
                        </Card>
                          )}

                        {/* HIGHEST OFFER */}
                        {!this.state.asset.sellOrders![0] && this.state.asset.buyOrders &&
                          this.state.asset.buyOrders[0] && (
                        <Card>
                          <Card.Header as="h5">Minimum Bid</Card.Header>
                          <Card.Body>
                            <Card.Title>{Web3Utils.fromWei(Math.max.apply(Math, this.state.asset!.buyOrders!.map(function(o) { return o.basePrice; })).toString(), "ether")} ETH</Card.Title>
                            <Button variant="secondary" onClick={this.createOffer}>Create Offer</Button>
                          </Card.Body>
                        </Card>
                          )}

                         {/* AUCTION WITHOUT ENDING PRICE */}
                         {/* {this.state.asset.sellOrders &&
                          this.state.asset.sellOrders[0] && (
                          <Card>
                            <Card.Header as="h5">Current Price</Card.Header>
                            <Card.Body>
                              <Card.Title>{Web3Utils.fromWei(this.state.asset!.sellOrders![0].currentPrice!.toString(), "ether")} ETH</Card.Title>
                              <Card.Text>
                                  With supporting text below as a natural lead-in to additional content.
                                </Card.Text>
                              <Button variant="primary m-2" onClick={this.buyNow}>Buy now</Button>
                              <Button variant="secondary" onClick={this.createOffer}>Create Offer</Button>
                            </Card.Body>
                          </Card>
                            )} */}

                        Debug:
                        {this.state.asset.sellOrders![0] && (<div>
                        Sale kind: {this.state.asset!.sellOrders![0].saleKind}
                        <br/>
                        Waiting For Best Counter Offer: {this.state.asset!.sellOrders![0].waitingForBestCounterOrder ? "true" : "false"}
                        </div>
                        )
                        }
                        {/* {this.state.asset.sellOrders &&
                          this.state.asset.sellOrders[0] && (
                            <div>
                              <h4>
                                Actual price:{" "}
                                {Web3Utils.fromWei(
                                  new BigNumber(
                                    this.state.asset.sellOrders[0].basePrice
                                  ).toString(),
                                  "ether"
                                )}{" "}
                                WETH{" "}
                              </h4>
                              {!this.state.isItemOwner &&
                                this.state.asset.sellOrders[0] && (
                                  <button onClick={this.buyNow}>Buy now</button>
                                )}
                            </div>
                          )}
                        {!this.state.isItemOwner ? (
                          <button onClick={this.createOffer}>
                            Create offer
                          </button>
                        ) : (
                          <button onClick={this.sellItemOnOpenSea}>
                            Sell item
                          </button>
                        )} */}
                      </Col>

                      {/* <ul>
                        {this.state.orders.map(
                          (item: OrderJSON, index: number) => {
                            return (
                              <li key={index}>
                                {item.side === 0 ? "Buy offer " : "Sell offer "}
                                {"By: " + item.maker + " "}
                                {"Price: " + item.basePrice + " "}
                              </li>
                            );
                          }
                        )}
                      </ul> */}
                    </Row>
                    {this.state.events && this.state.events[0] &&
                    <Table>
                    <thead>
                        <tr>
                          <th>Event</th>
                          <th>Price</th>
                          <th>From</th>
                          <th>To</th>
                          <th>Date</th>
                        </tr>
                      </thead>
                      <tbody>
                       {this.state.events!.map(
                          (item: any, index: number) => {
                            return (
                        <tr key={item.id}>
                          <td>{item.event_type}</td>
                          <td>{item.event_type == "created" ? Web3Utils.fromWei(item.starting_price,"ether") : item.event_type === "successful" || item.event_type === "transfer" ? "-" : Web3Utils.fromWei(item.bid_amount, "ether")}</td>
                          <td>{item.event_type == "successful" ? item.seller.address : item.from_account.address}</td>
                          <td>{item.event_type == "successful" ? item.seller.address : item.event_type == "transfer" ? item.to_account.address : "-"}</td>
                          <td>{item.created_date}</td>
                        </tr>
                            )})};
                      </tbody>
                    </Table>}
                  </Container>
                )}
              </SLanding>
            )}
          </SContent>
        </Column>
      </SLayout>
    );
  };
}

export default App;
