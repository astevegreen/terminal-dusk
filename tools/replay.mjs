// `pnpm replay <matchId>`: will turn a reported online game into a test fixture.
// Not available yet: the host builds a finished game's replay archive (`hostArchive`, packages/host), but the server
// does not store archives yet, so there is nothing to fetch by match ID. Storing them is the server's Finalize step
// (docs/architecture.md, Decision 5, Finalize; build order step 4). Until then it says so and fails.
const matchId = process.argv[2];
if (!matchId) {
  process.stderr.write("Usage: pnpm replay <matchId>\n");
  process.exit(1);
}
process.stderr.write(
  `pnpm replay is not available yet: the host builds replay archives (hostArchive), but the server does not store ` +
    `them yet, so match ${matchId} cannot be fetched.\n` +
    `Until then, reproduce match ${matchId}'s bug from the steps written in its issue.\n`,
);
process.exit(1);
