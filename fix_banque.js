const fs = require('fs');
const servicePath = 'backend/src/features/banque/banque.service.ts';
let content = fs.readFileSync(servicePath, 'utf8');
content = content.replace(/import \{ Injectable \} from '@nestjs\/common';/, "import { Injectable, BadRequestException } from '@nestjs/common';");
content = content.replace(/throw new Error/g, 'throw new BadRequestException');
fs.writeFileSync(servicePath, content);
console.log('Fixed banque.service.ts');
