import { hashNonce } from '@/auth/wallet/client-helpers';
import {
  MiniAppWalletAuthSuccessPayload,
  MiniKit,
  verifySiweMessage,
} from '@worldcoin/minikit-js';
import NextAuth, { type DefaultSession } from 'next-auth';
import Credentials from 'next-auth/providers/credentials';

declare module 'next-auth' {
  interface User {
    walletAddress: string;
    username: string;
    profilePictureUrl: string;
  }

  interface Session {
    user: {
      walletAddress: string;
      username: string;
      profilePictureUrl: string;
    } & DefaultSession['user'];
  }
}

// Auth configuration for Wallet Auth based sessions
// For more information on each option (and a full list of options) go to
// https://authjs.dev/getting-started/authentication/credentials
export const { handlers, auth } = NextAuth({
  secret: process.env.AUTH_SECRET ?? process.env.NEXTAUTH_SECRET,
  session: { strategy: 'jwt' },
  providers: [
    Credentials({
      name: 'World App Wallet',
      credentials: {
        nonce: { label: 'Nonce', type: 'text' },
        signedNonce: { label: 'Signed Nonce', type: 'text' },
        finalPayloadJson: { label: 'Final Payload', type: 'text' },
      },
      authorize: async (credentials) => {
        if (!credentials) return null;
        const { nonce, signedNonce, finalPayloadJson } = credentials;
        if (
          typeof nonce !== 'string' ||
          typeof signedNonce !== 'string' ||
          typeof finalPayloadJson !== 'string'
        ) {
          return null;
        }

        const expectedSignedNonce = hashNonce({ nonce });

        if (signedNonce !== expectedSignedNonce) {
          return null;
        }

        let finalPayload: MiniAppWalletAuthSuccessPayload;
        try {
          finalPayload = JSON.parse(
            finalPayloadJson
          ) as MiniAppWalletAuthSuccessPayload;
        } catch {
          return null;
        }
        const result = await verifySiweMessage(finalPayload, nonce);

        if (!result.isValid || !result.siweMessageData.address) {
          return null;
        }
        // Optionally, fetch the user info from your own database
        const address = result.siweMessageData.address;
        const userInfo = await MiniKit.getUserInfo(address);

        return {
          id: address,
          walletAddress: userInfo.walletAddress || address,
          username: userInfo.username ?? '',
          profilePictureUrl: userInfo.profilePictureUrl ?? '',
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.userId = user.id;
        token.walletAddress = user.walletAddress || user.id;
        token.username = user.username;
        token.profilePictureUrl = user.profilePictureUrl;
      }

      return token;
    },
    session: async ({ session, token }) => {
      if (token.userId) {
        session.user.id = token.userId as string;
        const wid = token.walletAddress as string | undefined;
        const uid = token.userId as string;
        session.user.walletAddress =
          wid && /^0x[a-fA-F0-9]{40}$/i.test(wid)
            ? wid
            : /^0x[a-fA-F0-9]{40}$/i.test(uid)
              ? uid
              : (wid ?? '');
        session.user.username = token.username as string;
        session.user.profilePictureUrl = token.profilePictureUrl as string;
      }

      return session;
    },
  },
});
