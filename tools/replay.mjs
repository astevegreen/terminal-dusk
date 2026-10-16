// `pnpm replay <matchId>`: will turn a reported online game into a test fixture.
// Not available yet: it needs the replay archives that the server writes when a game ends
// (docs/architecture.md, Decision 3), and no server code exists. Until then it says so and fails.
const matchId = process.argv[2];
if (!matchId) {
  process.stderr.write("Usage: pnpm replay <matchId>\n");
  process.exit(1);
}
process.stderr.write(
  `pnpm replay is not available yet: it needs the server's replay archives, which arrive with the first server task.\n` +
    `Until then, reproduce match ${matchId}'s bug from the steps written in its issue.\n`,
);
process.exit(1);
