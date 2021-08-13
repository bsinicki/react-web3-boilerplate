import * as React from 'react';
import styled from 'styled-components';
import { OrderSide,OrderJSON, OpenSeaAsset, Order} from 'opensea-js/lib/types'
import BigNumber from 'bignumber.js';

import Web3Modal from 'web3modal';
// @ts-ignore
import WalletConnectProvider from '@walletconnect/web3-provider';
import Column from './components/Column';
import Wrapper from './components/Wrapper';
import Header from './components/Header';
import Loader from './components/Loader';
import ConnectButton from './components/ConnectButton';
import { OpenSeaPort, Network } from 'opensea-js';
const Web3Utils = require('web3-utils');

import { Web3Provider } from '@ethersproject/providers';
import { getChainData } from './helpers/utilities';

// let seaport:any;
// let itemInfo = "";
// let userBalanceOfAsset:any = 0;
const asset = {
  tokenAddress: "0xCa26C6ECB3B0b35ed5FD4Cd4680547f3774D525a", // Uniq Collections
  tokenId: "7", // Token ID
}

const SLayout = styled.div`
  position: relative;
  width: 100%;
  min-height: 100vh;
  text-align: center;
`;

const SContent = styled(Wrapper)`
  width: 100%;
  height: 100%;
  padding: 0 16px;
`;

const SContainer = styled.div`
  height: 100%;
  min-height: 200px;
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  word-break: break-word;
`;

const SLanding = styled(Column)`
  height: 600px;
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
}

const INITIAL_STATE: IAppState = {
  fetching: false,
  address: '',
  library: null,
  connected: false,
  chainId: 1,
  pendingRequest: false,
  result: null,
  electionContract: null,
  asset: null,
  info: null,
  name: "",
  image: "https://lh3.googleusercontent.com/DBD8vFv2QZ-ZrJ4jKH2lVwrJxiw4qFw2ntwmT6Ly_MrXoc4HLjZleHprxpfSCPX6_Sw7h-rIFVJ8zluRKqWtFnbvk04NU8nUsxUHdg=s128",
  isItemOwner: null,
  orders: []
};

class App extends React.Component<any, any> {
  // @ts-ignore
  public web3Modal: Web3Modal;
  public state: IAppState;
  public provider: any;

  constructor(props: any) {
    super(props);
    this.state = {
      ...INITIAL_STATE
    };

    this.web3Modal = new Web3Modal({
      network: this.getNetwork(),
      cacheProvider: true,
      providerOptions: this.getProviderOptions()
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

    const address = this.provider.selectedAddress ? this.provider.selectedAddress : this.provider?.accounts[0];

    await this.setState({
      library,
      chainId: network.chainId,
      address,
      connected: true
    });

    await this.subscribeToProviderEvents(this.provider);
    await this.getOSItem();

  };

  public getOSItem = async () => {
    const address = this.provider.selectedAddress ? this.provider.selectedAddress : this.provider?.accounts[0];
    const seaport = new OpenSeaPort(this.provider, {
      networkName: Network.Rinkeby
    });

    const itemInfo = await seaport.api.getAsset(asset);
    await this.setState({asset: itemInfo});

    await this.setState({name: itemInfo.name});
    await this.setState({image: itemInfo.imageUrl});
    
    const isOwner = (itemInfo.owner.address === address);
    
    await this.setState({isItemOwner: isOwner});

    console.log(this.state.asset);
  }

  public getSellOrders = async () => {
    const seaport = new OpenSeaPort(this.provider, {
      networkName: Network.Rinkeby
    });

    const {orders} = await seaport.api.getOrders({
      asset_contract_address: asset.tokenAddress,
      token_id: asset.tokenId,
      side: OrderSide.Sell
    })

    await this.setState({orders: this.state.orders.concat(orders)});
  }

  public getBuyOrders = async () => {
    const seaport = new OpenSeaPort(this.provider, {
      networkName: Network.Rinkeby
    });

    const {orders} = await seaport.api.getOrders({
      asset_contract_address: asset.tokenAddress,
      token_id: asset.tokenId,
      side: OrderSide.Buy
    })

    await this.setState({orders: this.state.orders.concat(orders)});

    console.log(this.state.orders);
  }

  public connectToOpensea  = async ()  => {
    const address = this.provider.selectedAddress ? this.provider.selectedAddress : this.provider?.accounts[0];
    
    const seaport = new OpenSeaPort(this.provider, {
      networkName: Network.Rinkeby
    });

    const offer = await seaport.createBuyOrder({
      asset,
      accountAddress: address,
      startAmount: 0.75,
    })

    console.log(offer);
  }

  public buyNow  = async ()  => {
    const address = this.provider.selectedAddress ? this.provider.selectedAddress : this.provider?.accounts[0];
    
    const seaport = new OpenSeaPort(this.provider, {
      networkName: Network.Rinkeby
    });

    const order:Order = this.state.asset?.sellOrders?.[0]!;

    const transactionHash = await seaport.fulfillOrder({order, accountAddress:address })

    console.log(transactionHash);
  }

  public sellItemOnOpenSea  = async ()  => {
    const address = this.provider.selectedAddress ? this.provider.selectedAddress : this.provider?.accounts[0];
    
    const seaport = new OpenSeaPort(this.provider, {
      networkName: Network.Rinkeby
    });

    const expirationTime = Math.round(Date.now() / 1000 + 60 * 60 * 24)

    const listing = await seaport.createSellOrder({
      asset,
      accountAddress: address,
      startAmount: 0.75,
      expirationTime
    })

    console.log(listing);
  }

  public subscribeToProviderEvents = async (provider:any) => {
    if (!provider.on) {
      return;
    }

    provider.on("accountsChanged", this.changedAccount);
    provider.on("networkChanged", this.networkChanged);
    provider.on("close", this.close);

    await this.web3Modal.off('accountsChanged');
  };

  public async unSubscribe(provider:any) {
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
    if(!accounts.length) {
      // Metamask Lock fire an empty accounts array 
      await this.resetApp();
    } else {
      await this.setState({ address: accounts[0] });
      await this.getOSItem();
    }
  }

  public networkChanged = async (networkId: number) => {
    const library = new Web3Provider(this.provider);
    const network = await library.getNetwork();
    const chainId = network.chainId;
    await this.setState({ chainId, library });
  }
  
  public close = async () => {
    this.resetApp();
  }

  public getNetwork = () => getChainData(this.state.chainId).network;

  public getProviderOptions = () => {
    const providerOptions = {
      walletconnect: {
        package: WalletConnectProvider,
        options: {
          infuraId: process.env.REACT_APP_INFURA_ID
        }
      }
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
    const {
      address,
      connected,
      chainId,
      fetching
    } = this.state;
    return (
      <SLayout>
        <Column maxWidth={1000} spanHeight>
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
                  {!this.state.connected && <ConnectButton onClick={this.onConnect} />}
                  {/* <h5>{seaport && seaport}</h5> */}
                  {this.state.asset &&
                  <div>
                    {this.state.isItemOwner&&<h5>You're owner of this item</h5>}
                  <img
                    src={this.state.asset.imageUrl}
                   />
                   <h2>{this.state.asset.name}</h2>
                   {this.state.asset.sellOrders && this.state.asset.sellOrders[0] && <div>
                   <h4>Actual price: {Web3Utils.fromWei(new BigNumber(this.state.asset.sellOrders[0].basePrice).toString(),"ether")} WETH </h4>
                   {!this.state.isItemOwner&&this.state.asset.sellOrders[0]&&<button onClick={this.buyNow}>
                    Buy now
                    </button>}
                    </div>}
                  {!this.state.isItemOwner ? 
                  <button onClick={this.connectToOpensea}>
                    Create offer
                  </button>
                  :
                  <button onClick={this.sellItemOnOpenSea}>
                    Sell item
                  </button>
                  }

                  <ul>
                          { this.state.orders.map((item: OrderJSON, index: number) => {
                            return <li key={index}>
                              {(item.side===0)?"Buy offer ":"Sell offer "}
                              {"By: " + item.maker + " "}
                              {"Price: " + item.basePrice + " "} 
                              </li>;
                          })}
                        </ul>

                        </div>
                        }
                </SLanding>
              )}



          </SContent>
        </Column>
      </SLayout>

    );
  };
}

export default App;
