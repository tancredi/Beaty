var router = require('./core/router');

router
.add('/workspace', { templateName: 'workspace', controller: require('./controller/workspace') })
.otherwise('/workspace');