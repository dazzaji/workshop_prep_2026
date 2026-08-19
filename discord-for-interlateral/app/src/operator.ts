import { configFromEnv, teamByKey } from "./config.js";
import { openDb, setSetting, getSetting, getPhase, audit } from "./db.js";
import { revokeCredential, revokeUser } from "./store.js";

function usage(): never {
  console.log(`Usage:
  npm run op -- status
  npm run op -- pause-global | resume-global
  npm run op -- pause-team <team-key>
  npm run op -- resume-team <team-key>
  npm run op -- phase team|questions|both
  npm run op -- questions-post on|off
  npm run op -- revoke-user <discordUserId>
  npm run op -- revoke-credential <credentialId>
`);
  process.exit(2);
}

const [cmd, arg] = process.argv.slice(2);
if (!cmd) usage();

const config = configFromEnv();
const db = openDb(config.sqlitePath);

if (cmd === "status") {
  console.log(
    JSON.stringify(
      {
        sqlite: config.sqlitePath,
        phase: getPhase(db, config.defaultPhase),
        bridge_paused: getSetting(db, "bridge_paused") === "on",
        team_paused: Object.fromEntries(
          config.teams.map((team) => [team.key, getSetting(db, `team_paused:${team.key}`) === "on"]),
        ),
        questions_post: getSetting(db, "questions_post") ?? (config.questionsPostEnabled ? "on" : "off"),
      },
      null,
      2,
    ),
  );
} else if (cmd === "pause-global") {
  setSetting(db, "bridge_paused", "on");
  audit(db, "operator", "pause-global");
} else if (cmd === "resume-global") {
  setSetting(db, "bridge_paused", "off");
  audit(db, "operator", "resume-global");
} else if (cmd === "pause-team" && arg && teamByKey(config, arg)) {
  setSetting(db, `team_paused:${arg}`, "on");
  audit(db, "operator", `pause-team:${arg}`);
} else if (cmd === "resume-team" && arg && teamByKey(config, arg)) {
  setSetting(db, `team_paused:${arg}`, "off");
  audit(db, "operator", `resume-team:${arg}`);
} else if (cmd === "phase" && (arg === "team" || arg === "questions" || arg === "both")) {
  setSetting(db, "phase", arg);
  audit(db, "operator", `phase:${arg}`);
} else if (cmd === "questions-post" && (arg === "on" || arg === "off")) {
  setSetting(db, "questions_post", arg);
  audit(db, "operator", `questions-post:${arg}`);
} else if (cmd === "revoke-user" && arg) {
  console.log({ revoked: revokeUser(db, arg) });
} else if (cmd === "revoke-credential" && arg) {
  console.log({ revoked: revokeCredential(db, arg) });
} else {
  usage();
}
