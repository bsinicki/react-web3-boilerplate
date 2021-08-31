import * as React from "react";
import styled from "styled-components";
import {
  OrderSide,
  OrderJSON,
  OpenSeaAsset,
  Order,
} from "opensea-js/lib/types";
// import BigNumber from "bignumber.js";
import { Container, Row, Col, Card, Button, Table } from "react-bootstrap";
import "bootstrap/dist/css/bootstrap.min.css";
import axios from "axios";

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

enum CardNames {
  MinBid = "Minimum Bid",
  TopBid = "Top Bid",
  CurrentPrice = "Current Price",
  HighestOffer = "Highest offer",
  NoOffers = "No offers",
}

enum PaymentTokens {
  eth = "ETH",
  weth = "WETH",
}

interface IUniqlyOffer {
  price: string;
  paymentToken: PaymentTokens;
  expiration: string;
  fromAddress: string;
}

interface IUniqlyAsset {
  cardName: CardNames | null;
  name: string;
  ownersAddress: string;
  description: string;
  collectionName: string;
  tokenId: string;
  cardValue: string | null;
  cardPaymentToken: string | null;
  cardVerifiedOwnersName: string | null;
  cardExpirationDate: string | null;
  cardReservePrice: string | null;
  imageUrl: string;
  buyOffers: IUniqlyOffer[] | null;
  sellOffers: IUniqlyOffer[] | null;
}

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
  isItemOwner: boolean | null;
  orders: tOrders | any;
  seaport: OpenSeaPort | undefined;
  events: Object[] | null;
  uniqlyAsset: IUniqlyAsset | null;
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
  isItemOwner: null,
  seaport: undefined,
  orders: [],
  events: null,
  uniqlyAsset: null,
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
    const itemInfo = await this.state.seaport!.api.getAsset(asset);

    await this.setState({asset:itemInfo});

    console.log(itemInfo);

    const address = this.provider.selectedAddress
      ? this.provider.selectedAddress
      : this.provider?.accounts[0];

    let cardName: CardNames = CardNames.NoOffers;
    let cardValue: string | null = null;

    if (itemInfo.sellOrders && itemInfo.sellOrders![0]) {
      if (!itemInfo.sellOrders![0].waitingForBestCounterOrder) {
        cardName = CardNames.CurrentPrice;
        cardValue = Web3Utils.fromWei(
          Math.min
            .apply(
              Math,
              itemInfo.sellOrders!.map(function(o) {
                return o.currentPrice;
              })
            )
            .toString(),
          "ether"
        );
      } else if (
        Math.max.apply(
          Math,
          itemInfo.buyOrders!.map(function(o) {
            return o.basePrice;
          })
        ) > itemInfo.sellOrders![0].currentPrice!
      ) {
        cardName = CardNames.TopBid;
        cardValue = Web3Utils.fromWei(
          Math.max
            .apply(
              Math,
              itemInfo.buyOrders!.map(function(o) {
                return o.basePrice;
              })
            )
            .toString(),
          "ether"
        );
      } else {
        cardName = CardNames.MinBid;
        cardValue = Web3Utils.fromWei(
          Math.min
            .apply(
              Math,
              itemInfo.sellOrders!.map(function(o) {
                return o.currentPrice;
              })
            )
            .toString(),
          "ether"
        );
      }
    } else {
      if (itemInfo.buyOrders && itemInfo.buyOrders![0]) {
        cardName = CardNames.HighestOffer;
        cardValue = Web3Utils.fromWei(
          Math.max
            .apply(
              Math,
              itemInfo.buyOrders!.map(function(o) {
                return o.basePrice;
              })
            )
            .toString(),
          "ether"
        );
      }
    }

    let cardExpirationDate: string | null = null;
    // if(cardName===CardNames.TopBid){
    //   const winningOrder = itemInfo.buyOrders!.find(order => (Web3Utils.fromWei(order.basePrice.toString())).toString() === cardValue);
    //   console.log(winningOrder);
    //   cardExpirationDate = new Date(
    //     winningOrder!.expirationTime.mul(1000).toNumber()).toString();
    // }
    if (
      itemInfo.sellOrders![0] &&
      itemInfo.sellOrders![0].expirationTime.greaterThan(0)
    ) {
      const order = itemInfo.orders!.find(
        (order) => order.basePrice === itemInfo.sellOrders![0].basePrice
      );
      cardExpirationDate = new Date(
        order!.expirationTime.mul(1000).toNumber()
      ).toString();
    }

    let cardReservePrice: string | null = null;
    if (
      itemInfo.sellOrders![0] &&
      itemInfo.sellOrders![0].expirationTime &&
      itemInfo.sellOrders![0].extra.greaterThan(0)
    ) {
      cardReservePrice = Web3Utils.fromWei(
        itemInfo.sellOrders![0].extra!.toString(),
        "ether"
      );
    }

    let sellOffers: IUniqlyOffer[] = [];
    if (itemInfo.sellOrders) {
      for (let i = 0; i < itemInfo.sellOrders!.length; i++) {
        let offer: IUniqlyOffer = {
          price: itemInfo.sellOrders![i]!.basePrice.toString(),
          paymentToken: PaymentTokens.eth,
          expiration: itemInfo.sellOrders![i]!.expirationTime.toString(),
          fromAddress: itemInfo.sellOrders![i]!.makerAccount?.address!,
        };
        sellOffers.push(offer);
      }
    }

    let buyOrders: IUniqlyOffer[] = [];
    if (itemInfo.buyOrders) {
      for (let i = 0; i < itemInfo.buyOrders!.length; i++) {
        let offer: IUniqlyOffer = {
          price: itemInfo.buyOrders![i]!.basePrice.toString(),
          paymentToken: PaymentTokens.eth,
          expiration: itemInfo.buyOrders![i]!.expirationTime.toString(),
          fromAddress: itemInfo.buyOrders![i]!.makerAccount?.address!,
        };
        buyOrders.push(offer);
      }
    }

    let uniqlyAsset: IUniqlyAsset = {
      cardName,
      name: itemInfo.name,
      ownersAddress: itemInfo.owner.address,
      description: itemInfo.description,
      tokenId: itemInfo.tokenId!,
      collectionName: itemInfo.collection.name,
      cardValue,
      cardPaymentToken: "ETH",
      cardVerifiedOwnersName: null,
      cardExpirationDate,
      cardReservePrice,
      imageUrl: itemInfo.imageUrl,
      buyOffers: buyOrders,
      sellOffers,
    };

    await this.setState({ uniqlyAsset });
    if (uniqlyAsset.ownersAddress === address) {
      await this.setState({ isItemOwner: true });
    }

    setTimeout((async() => await this.getEvents()), 1000);  
    console.log(uniqlyAsset);
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
      startAmount: 1.1,
    });

    console.log(offer);
  };

  public acceptOffer = async () => {
    const offer = await this.state.seaport!.fulfillOrder({
      order: this.state.asset!.buyOrders![0]!,
      accountAddress: this.state.address
    });

    console.log(offer);
  }

  public cancelOffer = async () => {
    const address:string = this.provider.selectedAddress
      ? this.provider.selectedAddress
      : this.provider?.accounts[0];

    const order:Order = this.state.asset!.buyOrders!.find(order => order.makerAccount!.address === address)!;

    console.log(order);

    const offer = await this.state.seaport!.cancelOrder({
      order,
      accountAddress: address
    });

    console.log(offer);
  };

  public buyNow = async () => {
    const address = this.provider.selectedAddress
      ? this.provider.selectedAddress
      : this.provider?.accounts[0];

    console.log(this.state.asset);

    const order: Order = this.state.asset!.sellOrders?.[0]!;

    const transactionHash = await this.state.seaport!.fulfillOrder({
      order,
      accountAddress: address,
    });

    console.log(transactionHash);

  };

  public getEvents = async () => {
    let res: any = [];
    await axios
      .get("https://rinkeby-api.opensea.io/api/v1/events", {
        params: {
          asset_contract_address: asset.tokenAddress,
          token_id: asset.tokenId,
          only_opensea: false,
          offset: 0,
          limit: 200,
        },
      })
      .then(function(response: any) {
        res = response;
      })
      .catch(function(error: any) {
        console.log(error);
      })
      .then(function() {});
    await this.setState({ events: res.data.asset_events });
    console.log(this.state.events);
  };

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

                {this.state.uniqlyAsset && (
                  <Container>
                    <Row>
                      <Col>
                        {/* Image */}
                        <img src={this.state.uniqlyAsset?.imageUrl} />
                      </Col>
                      <Col>
                        {/* Collection name */}
                        <div>
                          <b>{this.state.uniqlyAsset?.collectionName}</b>
                        </div>
                        {/* Asset name */}
                        <h3 onClick={this.getAssets}>
                          {this.state.uniqlyAsset?.name}
                        </h3>
                        {/* Owner */}
                        {this.state.isItemOwner ? (
                          <div>You're owner of this item</div>
                        ) : (
                          <div>
                            Owner is {this.state.uniqlyAsset.ownersAddress}
                          </div>
                        )}
                        <Card>
                          <Card.Header as="h5">
                            {this.state.uniqlyAsset.cardName}
                          </Card.Header>
                          <Card.Body>
                            <Card.Title>
                              {this.state.uniqlyAsset.cardValue}{" "}
                              {this.state.uniqlyAsset.cardValue &&
                                this.state.uniqlyAsset.cardPaymentToken}
                            </Card.Title>
                            <Card.Text>
                              {this.state.uniqlyAsset.cardExpirationDate &&
                                "Sale ends: " &&
                                this.state.uniqlyAsset.cardExpirationDate}
                            </Card.Text>

                            {/* Buttons */}

                            {/* Owner */}
                            {/* No sell orders */}
                            {this.state.isItemOwner &&
                              !this.state.uniqlyAsset.sellOffers && (
                                <Button
                                  variant="primary"
                                  onClick={this.createOffer}
                                >
                                  Sell
                                </Button>
                              )}

                            {/* Have sell orders */}
                            {this.state.isItemOwner &&
                              this.state.uniqlyAsset.sellOffers && (
                                <div>
                                  <Button
                                    variant="primary"
                                    onClick={this.createOffer}
                                    className="m-1"
                                  >
                                    Lower price
                                  </Button>
                                  <Button
                                    variant="secondary"
                                    onClick={this.createOffer}
                                    className="m-1"
                                  >
                                    Cancel Listing
                                  </Button>
                                </div>
                              )}

                            {/* Not Owner */}
                            {/* Have no orders */}
                            {!this.state.isItemOwner &&
                              this.state.uniqlyAsset.cardName ===
                                CardNames.NoOffers && (
                                <div>
                                  <Button
                                    variant="primary"
                                    onClick={this.createOffer}
                                    className="m-1"
                                  >
                                    Make Offer
                                  </Button>
                                </div>
                              )}

                            {/* Have sell orders */}
                            {!this.state.isItemOwner &&
                              (this.state.uniqlyAsset.cardName ===
                                CardNames.CurrentPrice ||
                                this.state.uniqlyAsset.cardName ===
                                  CardNames.HighestOffer) && (
                                <div>
                                  {this.state.uniqlyAsset.cardName ===
                                CardNames.CurrentPrice  && <Button
                                    variant="primary"
                                    onClick={this.buyNow}
                                    className="m-1"
                                  >
                                    Buy now
                                  </Button> }
                                  <Button
                                    variant="secondary"
                                    onClick={this.createOffer}
                                    className="m-1"
                                  >
                                    Make offer
                                  </Button>
                                </div>
                              )}

                            {/* Have Bids */}
                            {(!this.state.isItemOwner && (
                              this.state.uniqlyAsset.cardName ===
                                CardNames.MinBid ||
                              this.state.uniqlyAsset.cardName ===
                                CardNames.TopBid)  && 
                                <div>
                                  <Button
                                    variant="primary"
                                    onClick={this.createOffer}
                                    className="m-1"
                                  >
                                    Place Bid
                                  </Button>
                                </div>
                              )}
                          </Card.Body>
                        </Card>
                      </Col>
                    </Row>

                    <h4>Orders</h4>
                    {this.state.uniqlyAsset.buyOffers &&
                      this.state.uniqlyAsset.buyOffers[0] && (
                        <Table>
                          <thead>
                            <tr>
                              <th>Price</th>
                              <th>Expiration</th>
                              <th>From</th>
                            </tr>
                          </thead>
                          <tbody>
                            {this.state.uniqlyAsset.buyOffers!.map(
                              (order: IUniqlyOffer, index: number) => {
                                return (
                                  <tr key={index}>
                                    <td>{order.price}</td>
                                    <td>{order.expiration} {order.fromAddress === this.state.address && <Button
                                    variant="secondary"
                                    size="sm"
                                    onClick={this.cancelOffer}
                                  >
                                    Cancel
                                  </Button>}
                                  {this.state.isItemOwner && <Button
                                    variant="secondary"
                                    size="sm"
                                    onClick={this.acceptOffer}
                                  >
                                    Accept
                                  </Button>}
                                  </td>
                                    <td>{order.fromAddress}</td>
                                  </tr>
                                );
                              }
                            )}
                          </tbody>
                        </Table>
                      )}

                    <h4>History</h4>
                    {this.state.events && this.state.events[0] && (
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
                                  <td>
                                    {item.event_type == "created"
                                      ? item.starting_price
                                      : item.event_type === "successful" ||
                                        item.event_type === "transfer"
                                      ? "-"
                                      : Web3Utils.fromWei(
                                          item.bid_amount
                                            ? item.bid_amount
                                            : "0",
                                          "ether"
                                        )}
                                  </td>
                                  <td>
                                    {item.event_type == "successful"
                                      ? item.seller.address
                                      : item.from_account
                                      ? item.from_account.address
                                      : "-"}
                                  </td>
                                  <td>
                                    {item.event_type == "successful"
                                      ? item.winner_account.address
                                      : item.event_type == "transfer"
                                      ? item.to_account.address
                                      : "-"}
                                  </td>
                                  <td>{item.created_date}</td>
                                </tr>
                              );
                            }
                          )}
                          ;
                        </tbody>
                      </Table>
                    )}
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
