const {
    Connection,
    PublicKey,
    Transaction,
    SystemProgram,
    SYSVAR_RENT_PUBKEY,
} = solanaWeb3;

// Raydium's Pool Address for SOL-POT Pair
const SOL_MINT_ADDRESS = new PublicKey('So11111111111111111111111111111111111111112'); // Wrapped SOL
const POT_MINT_ADDRESS = new PublicKey('4F9ynftRHYq3UndTqpTr7hPUUgpynCPiqHxJisqGtXjH');
const SOL_DECIMALS = 9;
const POT_DECIMALS = 6;
const connection = new solanaWeb3.Connection("https://mainnet.helius-rpc.com/?api-key=786fff54-33ae-4f09-8252-ea85b96b6da2");

let walletConnected = false;
let provider = null;
let currentAccount = null;

// Function to get the Phantom provider
function getProvider() {
    if ('solana' in window) {
        const provider = window.solana;
        if (provider.isPhantom) {
            return provider;
        }
    }
    console.error('Phantom wallet not found. Please ensure it is installed and in Solana mode.');
    return null;
}

// Function to connect to Phantom Wallet
async function connectWallet() {
    try {
        provider = getProvider();
        if (provider) {
            const response = await provider.connect(); // Connect to the wallet
            if (response && response.publicKey) {
                console.log('Wallet connected:', response.publicKey.toString());
                currentAccount = response.publicKey.toString();
                walletConnected = true;
                updateSwapButton(); // Update the UI based on wallet connection
                setupWalletEventListeners(); // Set up event listeners for account changes and disconnections
            } else {
                console.error('Failed to get public key after connection.');
            }
        }
    } catch (error) {
        console.error('Error during wallet connection:', error);
    }
}

// Function to handle wallet disconnection
async function disconnectWallet() {
    try {
        if (provider) {
            await provider.disconnect(); // Disconnect from the wallet
            console.log('Wallet disconnected');
            walletConnected = false;
            currentAccount = null;
            updateSwapButton(); // Update the UI based on disconnection
        }
    } catch (error) {
        console.error('Error during wallet disconnection:', error);
    }
}

// Function to set up event listeners for Phantom wallet events
function setupWalletEventListeners() {
    // Handle account changes (when the user switches accounts)
    provider.on('accountChanged', (publicKey) => {
        if (publicKey) {
            console.log('Wallet account changed to:', publicKey.toBase58());
            currentAccount = publicKey.toBase58();
            walletConnected = true;
            updateSwapButton(); // Update the button since the wallet is still connected
        } else {
            console.log('Wallet disconnected or account removed.');
            walletConnected = false;
            currentAccount = null;
            updateSwapButton(); // Update the button since no account is connected
            // Optionally reconnect if desired:
            provider.connect().catch((error) => {
                console.error('Error reconnecting after account change:', error);
            });
        }
    });

    // Handle wallet disconnection
    provider.on('disconnect', () => {
        console.log('Wallet disconnected.');
        walletConnected = false;
        currentAccount = null;
        updateSwapButton(); // Update the button based on the disconnection
    });
}

// Function to fetch conversion rate between SOL and POT using Jupiter Price API
async function fetchConversionRate(fromTokenMint, toTokenMint) {
    const url = `https://price.jup.ag/v6/price?ids=${fromTokenMint}&vsToken=${toTokenMint}`;
    
    try {
        const response = await fetch(url);
        const data = await response.json();
        const price = data.data[fromTokenMint.toBase58()]?.price || 0;
        return price;
    } catch (error) {
        console.error('Error fetching conversion rate:', error);
        return 0;
    }
}

// Function to update the to-amount when the user enters the from-amount
async function updateToAmount() {
    const fromAmount = parseFloat(document.getElementById('from-amount').value);
    if (isNaN(fromAmount) || fromAmount <= 0) return;

    const fromTokenName = document.getElementById('from-token-name').textContent;
    const fromTokenMint = fromTokenName === 'SOL' ? SOL_MINT_ADDRESS : POT_MINT_ADDRESS;
    const toTokenMint = fromTokenName === 'SOL' ? POT_MINT_ADDRESS : SOL_MINT_ADDRESS;

    try {
        const conversionRate = await fetchConversionRate(fromTokenMint, toTokenMint);
        const toAmount = fromAmount * conversionRate;
        document.getElementById('to-amount').value = toTokenMint === POT_MINT_ADDRESS ? toAmount.toFixed(1) : toAmount.toFixed(9); // 1 decimal for POT, 9 for SOL
    } catch (error) {
        console.error('Error updating amount:', error);
    }
}

// Swap Tokens Function (Swap SOL and POT in UI)
function swapTokens() {
    const fromTokenName = document.getElementById('from-token-name').textContent;
    const toTokenName = document.getElementById('to-token-name').textContent;

    // Swap token names
    document.getElementById('from-token-name').textContent = toTokenName;
    document.getElementById('to-token-name').textContent = fromTokenName;

    // Swap token images (if you have images for tokens)
    const fromTokenImg = document.getElementById('from-token-img').src;
    const toTokenImg = document.getElementById('to-token-img').src;
    document.getElementById('from-token-img').src = toTokenImg;
    document.getElementById('to-token-img').src = fromTokenImg;

    // Swap input values
    const fromAmount = document.getElementById('from-amount').value;
    const toAmount = document.getElementById('to-amount').value;
    document.getElementById('from-amount').value = toAmount;
    document.getElementById('to-amount').value = fromAmount;

    // Update the conversion rate after swapping
    updateToAmount();
}

// Main function to perform swap
async function performSwap() {
    try {
        if (!provider || !provider.publicKey) {
            console.error('Wallet not connected');
            alert('Please connect your wallet first.');
            return;
        }

        const userPublicKey = provider.publicKey.toBase58(); // Ensure the wallet is properly connected before using the public key
        const fromAmount = parseFloat(document.getElementById('from-amount').value);

        if (isNaN(fromAmount) || fromAmount <= 0) {
            alert('Please enter a valid amount to swap.');
            return;
        }

        console.log(`Attempting to swap ${fromAmount}...`);

        const inputMint = SOL_MINT_ADDRESS;
        const outputMint = POT_MINT_ADDRESS;
        const amountInSmallestUnits = Math.floor(fromAmount * Math.pow(10, SOL_DECIMALS));

        // Step 1: Fetch the quote
        const quoteUrl = `https://quote-api.jup.ag/v6/quote?inputMint=${inputMint.toBase58()}&outputMint=${outputMint.toBase58()}&amount=${amountInSmallestUnits}&slippageBps=200`;
        console.log('Fetching swap route from:', quoteUrl);

        const quoteResponse = await fetch(quoteUrl, {
            method: 'GET',
            headers: { 'Accept': 'application/json' },
        });

        if (!quoteResponse.ok) {
            throw new Error(`Error fetching quote: ${quoteResponse.statusText}`);
        }

        const quoteData = await quoteResponse.json();
        console.log('Quote data received:', quoteData);

        if (!quoteData.routePlan || quoteData.routePlan.length === 0) {
            console.error("No swap routes found.");
            alert('No swap routes available.');
            return;
        }

        console.log('Route Plan:', quoteData.routePlan);

        const bestRoute = quoteData.routePlan[0]; // Take the first route
        if (!bestRoute || !bestRoute.swapInfo) {
            console.error("Invalid route plan found.");
            alert('Invalid swap route.');
            return;
        }

        console.log('Best route swap info:', bestRoute.swapInfo);

        // Step 2: Prepare the swap request
        const swapRequestBody = {
            quoteResponse: quoteData, // Pass the full quote response
            userPublicKey: userPublicKey,
            wrapAndUnwrapSol: true,
            asLegacyTransaction: true // If your wallet does not support versioned transactions
        };

        console.log('Sending swap request to Jupiter...');

        // Step 3: Send the swap request to Jupiter API
        const swapResponse = await fetch('https://quote-api.jup.ag/v6/swap', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(swapRequestBody), // Send the entire quote response
        });

        if (!swapResponse.ok) {
            throw new Error(`Error sending swap request: ${swapResponse.statusText}`);
        }

        const swapData = await swapResponse.json();
        if (swapData.error) {
            console.error("Swap failed:", swapData.error);
            alert('Swap failed. Please try again.');
            return;
        }

        console.log("Swap transaction:", swapData.swapTransaction);

        // Step 4: Convert the base64 transaction data to Uint8Array
        const transactionBuffer = Uint8Array.from(atob(swapData.swapTransaction), c => c.charCodeAt(0));

        const transaction = solanaWeb3.Transaction.from(transactionBuffer);
        const signedTransaction = await provider.signTransaction(transaction);
        const signature = await connection.sendRawTransaction(signedTransaction.serialize());

        console.log("Transaction signature:", signature);
        alert('Swap completed successfully! Transaction signature: ' + signature);
    } catch (error) {
        console.error("Error performing swap:", error);
        alert(`Error performing swap: ${error.message}`);
    }
}

// Function to update the swap button based on wallet status
function updateSwapButton() {
    const swapButton = document.getElementById('swap-button');
    if (walletConnected) {
        swapButton.textContent = 'Swap';
        swapButton.onclick = performSwap;
    } else {
        swapButton.textContent = 'Connect Wallet';
        swapButton.onclick = connectWallet;
    }
}

// Ensure wallet connection is only triggered by button click
document.addEventListener('DOMContentLoaded', () => {
    updateSwapButton(); // Update the button state on page load

    // Optionally check if Phantom is already connected on page load:
    provider = getProvider();
    if (provider && provider.isConnected) {
        provider.connect().then((response) => {
            if (response.publicKey) {
                currentAccount = response.publicKey.toBase58();
                walletConnected = true;
                updateSwapButton();
                setupWalletEventListeners(); // Ensure event listeners are set
            }
        }).catch((error) => {
            console.error('Error connecting to wallet on page load:', error);
        });
    }

    // Listen for input changes on the "from-amount" field to update the "to-amount"
    const fromAmountInput = document.getElementById('from-amount');
    fromAmountInput.addEventListener('input', updateToAmount);
});
