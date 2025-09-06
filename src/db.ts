import Database from "better-sqlite3";
import path from "path";

// Chemin vers le fichier SQLite (persistance avec Docker)
const dbPath = path.join(__dirname, "../../database.sqlite");
const db = new Database(dbPath);

// Création des tables si elles n'existent pas
db.prepare(
	`
  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    points INTEGER DEFAULT 0
  )
`
).run();

// Tu peux ajouter d'autres tables ici plus tard
// db.prepare(`CREATE TABLE IF NOT EXISTS achievements (...)`).run();

export default db;
