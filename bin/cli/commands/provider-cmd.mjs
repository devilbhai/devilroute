export function registerProvider(program) {
  program
    .command("provider [subcommand]")
    .description("Manage provider connections (use 'providers' for the full interface)")
    .allowUnknownOption()
    .allowExcessArguments()
    .action(() => {
      console.log(`
  Use \`devilroute providers\` for the full provider management interface:

    devilroute providers available   — show provider catalog
    devilroute providers list        — list configured connections
    devilroute providers test <name> — test a provider connection
    devilroute providers test-all    — test all active connections
    devilroute providers validate    — validate local configuration
`);
    });
}
