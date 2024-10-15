// src/index.js

import { Connection, PublicKey } from '@solana/web3.js';
import { JupiterApi } from '@jup-ag/api';

// Initialize variables
let jupiterApi = null;
let walletConnected = false;
let provider = null;

// Define token decimals
const SOL_DECIMALS = 9;
const POT_DECIMALS = 6;

// Define mint addresses
const SOL_MINT = new PublicKey('So11111111111111111111111111111111111111112'); // Wrapped SOL
const POT_MINT = new PublicKey('4F9ynftRHYq3UndTqpTr7hPUUgpynCPiqHxJisqGtXjH');

// Function to get the provider
function getProvider() {
  if ('solana' in window) {
    const provider = window.solana;
    if (provider.isPhantom) {
      return provider;
    }
  }
  console.log('Phantom Wallet not found');
  window.open('https://phantom.app/', '_blank');
  return null;
}

// Function to connect to Phantom Wallet
async function connectWallet() {
  try {
    provider = getProvider();
    if (provider) {
      const response = await provider.connect();
      console.log('Wallet connected:', response.publicKey.toString());
      walletConnected = true;
      updateSwapButton();
    }
  } catch (error) {
    if (error.code === 4001) {
      console.warn('User rejected the request to connect the wallet.');
    } else {
      console.error('Wallet connection error:', error);
    }
  }
}

// Function to initialize Jupiter API
async function initializeJupiterApi() {
  try {
    const connection = new Connection('https://api.mainnet-beta.solana.com');
    jupiterApi = new JupiterApi({ baseUrl: 'https://quote-api.jup.ag' });
    console.log('Jupiter API initialized');
  } catch (error) {
    console.error('Error initializing Jupiter API:', error);
  }
}

// Function to perform the swap
async function performSwap() {
  try {
    if (!walletConnected) {
      console.error('Wallet not connected');
      alert('Please connect your wallet first.');
      return;
    }

    if (!jupiterApi) {
      console.error('Jupiter API not initialized');
      alert('Jupiter API is not initialized.');
      return;
    }

    const fromAmount = parseFloat(document.getElementById('from-amount').value);
    if (isNaN(fromAmount) || fromAmount <= 0) {
      alert('Please enter a valid amount to swap.');
      return;
    }

    let inputMint, outputMint, inputDecimals;
    const fromTokenName = document.getElementById('from-token-name').textContent;

    if (fromTokenName === 'SOL') {
      inputMint = SOL_MINT.toBase58();
      outputMint = POT_MINT.toBase58();
      inputDecimals = SOL_DECIMALS;
    } else {
      inputMint = POT_MINT.toBase58();
      outputMint = SOL_MINT.toBase58();
      inputDecimals = POT_DECIMALS;
    }

    const amountInLamports = Math.floor(fromAmount * Math.pow(10, inputDecimals));
    const slippageBps = 100; // 1% slippage tolerance

    const routes = await jupiterApi.getRoutes({
      inputMint: inputMint,
      outputMint: outputMint,
      amount: amountInLamports,
      slippageBps: slippageBps,
    });

    if (!routes || routes.length === 0) {
      alert('No swap routes found.');
      return;
    }

    const bestRoute = routes[0];
    console.log('Best Route:', bestRoute);

    const { swapTransaction } = bestRoute;
    const signedTransaction = await provider.signTransaction(swapTransaction);
    const connection = new Connection('https://api.mainnet-beta.solana.com');
    const txid = await connection.sendRawTransaction(signedTransaction.serialize());
    await connection.confirmTransaction(txid);

    console.log('Swap successful:', txid);
    alert('Swap completed successfully! Transaction ID: ' + txid);
  } catch (error) {
    console.error('Error performing swap:', error);
    alert('An error occurred during the swap. Please try again.');
  }
}

// Swap Tokens Function
function swapTokens() {
  // Swap the token names
  const fromTokenName = document.getElementById('from-token-name').textContent;
  const toTokenName = document.getElementById('to-token-name').textContent;
  document.getElementById('from-token-name').textContent = toTokenName;
  document.getElementById('to-token-name').textContent = fromTokenName;

  // Swap the token images
  const fromTokenImg = document.getElementById('from-token-img').src;
  const toTokenImg = document.getElementById('to-token-img').src;
  document.getElementById('from-token-img').src = toTokenImg;
  document.getElementById('to-token-img').src = fromTokenImg;

  // Swap the input values
  const fromAmount = document.getElementById('from-amount').value;
  const toAmount = document.getElementById('to-amount').value;
  document.getElementById('from-amount').value = toAmount;
  document.getElementById('to-amount').value = fromAmount;
}

// Function to update the swap button based on wallet status
function updateSwapButton() {
  const swapButton = document.getElementById('swap-button');
  if (swapButton) {
    if (walletConnected) {
      swapButton.textContent = 'Swap';
      swapButton.onclick = performSwap;
    } else {
      swapButton.textContent = 'Connect Wallet';
      swapButton.onclick = connectWallet;
    }
  } else {
    console.error('swapButton element not found in the DOM');
  }
}

// Attach functions to the global window object if necessary
window.connectWallet = connectWallet;
window.performSwap = performSwap;
window.swapTokens = swapTokens;

// Initialize on DOMContentLoaded
document.addEventListener('DOMContentLoaded', () => {
  updateSwapButton();

  // Add event listener to swap arrow button
  const swapArrowButton = document.querySelector('.swap-arrow button');
  if (swapArrowButton) {
    swapArrowButton.addEventListener('click', swapTokens);
  } else {
    console.error('Swap arrow button not found');
  }
});
