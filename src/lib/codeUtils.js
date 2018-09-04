module.exports = {
  translateModulesFromDb,
  translateModulesToDb
}

function translateModulesFromDb (modules) {
  modules = modules || {}

  for (const key in modules) {
    const newKey = key
      .replace(/\$DOT\$/g, '.')
      .replace(/\$SLASH\$/g, '/')
      .replace(/\$BACKSLASH\$/g, '\\')
    if (newKey !== key) {
      modules[newKey] = modules[key]
      delete modules[key]
    }
  }
  return modules
}

function translateModulesToDb (modules) {
  modules = modules || {}

  for (var key in modules) {
    const newKey = key
      .replace(/\./g, '$DOT$')
      .replace(/\//g, '$SLASH$')
      .replace(/\\/g, '$BACKSLASH$')

    if (newKey[0] === '$') {
      delete modules[key]
      continue
    }

    if (newKey !== key) {
      modules[newKey] = modules[key]
      delete modules[key]
    }
  }

  if (!modules.main) {
    modules.main = ''
  }
  return modules
}
