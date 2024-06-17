import {
    initEccLib,
    networks,
    script,
    payments,
    crypto,
    Psbt
} from "bitcoinjs-lib";
import { broadcast, waitUntilUTXO } from "./blockstream_utils.js";
import { ECPairFactory } from 'ecpair';
import * as tinysecp from 'tiny-secp256k1';
initEccLib(tinysecp);

const ECPair = ECPairFactory(tinysecp);
const network = networks.testnet;

console.log(`testnet network: ${JSON.stringify(network)}`);

async function start() {
    // let keypair = ECPair.makeRandom({ network });
    let privateKey = 'a000x0xa.....1111';
    let keypair = ECPair.fromPrivateKey(Buffer.from(privateKey, 'hex'), { network });

    await start_p2pktr(keypair);
}

async function start_p2pktr(keypair) {
    console.log(`Running "Pay to Pubkey with taproot"`);
    // Tweak the original keypair
    const tweakedSigner = tweakSigner(keypair, { network });
    // Generate an address from the tweaked public key
    const p2pktr = payments.p2tr({
        pubkey: toXOnly(tweakedSigner.publicKey),
        network
    });
    const p2pktr_addr = p2pktr.address ?? "";
    console.log(`Waiting till UTXO is detected at this Address: ${p2pktr_addr}`);

    const utxos = await waitUntilUTXO(p2pktr_addr)
    var choosed_utxo = utxos.filter(utxo => utxo.txid === 'ee831b4f38d104f21cd204e764c84ef1206786d6d82152c027b957044aae69bc')[0];
    console.log(`Using UTXO ${choosed_utxo.txid}:${choosed_utxo.vout}:value(${choosed_utxo.value})`);

    const psbt = new Psbt({ network });
    psbt.addInput({
        hash: choosed_utxo.txid,
        index: choosed_utxo.vout,
        witnessUtxo: { value: choosed_utxo.value, script: p2pktr.output },
        tapInternalKey: toXOnly(keypair.publicKey)
    });

    psbt.addOutput({
        address: "tb1p7s4hzqhtwfs7apvge86va86p28xd4htzc67ha2pftw82hrsc8nfqcdghen",
        value: choosed_utxo.value - 120
    });

    psbt.signInput(0, tweakedSigner);
    psbt.finalizeAllInputs();

    const tx = psbt.extractTransaction();
    console.log(`Broadcasting Transaction Hex: ${tx.toHex()}`);
    console.log(`Broadcasting Transaction Hex size: ${tx.toHex().length/2} bytes`);
    const txid = await broadcast(tx.toHex());
    console.log(`Success! Txid is ${txid}`);
}

start().then(() => process.exit());

function tweakSigner(signer, opts = {}) {
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
    let privateKey = signer.privateKey;
    if (!privateKey) {
        console.error(`Private key is required for tweaking signer!`);
        return
    }
    if (signer.publicKey[0] === 3) {
        privateKey = tinysecp.privateNegate(privateKey);
    }

    const tweakedPrivateKey = tinysecp.privateAdd(
        privateKey,
        tapTweakHash(toXOnly(signer.publicKey), opts.tweakHash),
    );
    if (!tweakedPrivateKey) {
        console.error(`Invalid tweaked private key!`);
        return
    }

    return ECPair.fromPrivateKey(Buffer.from(tweakedPrivateKey), {
        network: opts.network,
    });
}

function tapTweakHash(pubKey, h) {
    return crypto.taggedHash(
        'TapTweak',
        Buffer.concat(h ? [pubKey, h] : [pubKey]),
    );
}

function toXOnly(pubkey) {
    return pubkey.subarray(1, 33)
}