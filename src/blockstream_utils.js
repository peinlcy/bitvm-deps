import axios from "axios";

const blockstream = new axios.Axios({
    // baseURL: `https://blockstream.info/testnet/api`
    baseURL: `https://mempool.space/signet/api`
});

export async function waitUntilUTXO(address) {
    return new Promise((resolve, reject) => {
        let intervalId;
        const checkForUtxo = async () => {
            try {
                const response = await blockstream.get(`/address/${address}/utxo`);
                const data = response.data ? JSON.parse(response.data) : undefined;
                if (data.length > 0) {
                    console.log(`all utxos: ${JSON.stringify(data)}`);
                    resolve(data);
                    clearInterval(intervalId);
                }
            } catch (error) {
                reject(error);
                clearInterval(intervalId);
            }
        };
        intervalId = setInterval(checkForUtxo, 10000);
    });
}

export async function broadcast(txHex) {
    const response = await blockstream.post('/tx', txHex);
    return response.data;
}

// interface IUTXO {
//     txid: string;
//     vout: number;
//     status: {
//         confirmed: boolean;
//         block_height: number;
//         block_hash: string;
//         block_time: number;
//     };
//     value: number;
// }
