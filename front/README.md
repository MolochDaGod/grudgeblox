This is the Next.js client for GrudgeBlox.

## Getting Started

Install and run from the repository root with the lockfile-selected package manager:

```bash
pnpm install --frozen-lockfile
pnpm dev
```

Open [http://127.0.0.1:4000](http://127.0.0.1:4000) in a browser. Development listeners default to loopback, so this does not expose the game to the local network.

Copy `.env.example` to an untracked `.env.local` only when local overrides are needed. Never commit deployment credentials.

## WebSocket routing

- `NEXT_PUBLIC_SERVER_URL=ws://127.0.0.1` uses the one normal local backend on port 8001 for every world.
- An explicit port, such as `ws://127.0.0.1:9000`, overrides the world port.
- A non-loopback production host without a port keeps each world's configured port (8001–8005), matching the multi-instance deployment.

If the server cannot be reached, the play screen shows a bounded failure state with a safe retry button instead of remaining on an indefinite loading screen.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js/) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/deployment) for more details.
