const { getDefaultConfig } = require('expo/metro-config')

const config = getDefaultConfig(__dirname)

// This app lives inside the same git repo as the Next.js web app (../) but
// is a fully separate npm project with its own node_modules and its own
// package.json — not an npm/yarn workspace. Metro's default projectRoot
// already scopes watching to this directory; asserting it explicitly here
// just documents that. (expo-doctor will flag react as "duplicated" against
// the web app's node_modules — that's expected for two unrelated sibling
// projects, not a real conflict: Metro always resolves the nearest
// node_modules first, same as Node's own algorithm, so this app's own
// react/react-native always win. Overriding resolver.disableHierarchicalLookup
// to "fix" that warning is explicitly discouraged by expo-doctor itself.)
config.watchFolders = [__dirname]

module.exports = config
