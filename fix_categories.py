service_path = 'backend/src/features/banque/banque.service.ts'
with open(service_path, 'r', encoding='utf-8') as f:
    content = f.read()

old_logic = """  guessTransactionType(description: string, type: string) {
    const desc = description.toLowerCase();
    if (desc.includes('agios') || desc.includes('frais') || desc.includes('timbre') || desc.includes('commission')) {
      return 'FRAIS_BANCAIRES';
    }
    if (desc.includes('cheque') || desc.includes('chq')) return 'CHEQUE';
    if (desc.includes('virement') || desc.includes('vir')) return 'VIREMENT';
    if (desc.includes('carte') || desc.includes('tpe')) return 'CARTE';
    return 'AUTRE';"""

new_logic = """  guessTransactionType(description: string, type: string) {
    const desc = description.toLowerCase();
    if (desc.includes('agios') || desc.includes('frais') || desc.includes('timbre') || desc.includes('commission')) {
      return 'FRAIS_BANCAIRES';
    }
    if (desc.includes('cheque') || desc.includes('chq')) return 'CHEQUE';
    if (desc.includes('virement') || desc.includes('vir.') || desc.includes('vir ')) return 'VIREMENT';
    if (desc.includes('carte') || desc.includes('tpe') || desc.includes('/cb ') || desc.includes(' cb ') || desc.includes('paiment/cb')) return 'CARTE';
    if (desc.includes('lcn') || desc.includes('effet')) return 'LCN';
    if (desc.includes('prelevement') || desc.includes('prlv')) return 'PRELEVEMENT';
    if (desc.includes('versement') || desc.includes('espece')) return 'ESPECES';
    return 'AUTRE';"""

if old_logic in content:
    content = content.replace(old_logic, new_logic)
    with open(service_path, 'w', encoding='utf-8') as f:
        f.write(content)
