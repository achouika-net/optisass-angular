# 🧪 CHECKLIST TESTING

**Usage**: Avant de déployer feature

---

## 📊 TYPES DE TESTS

### 1️⃣ Unit Tests (80%+ couverture)

**Backend Services**
```typescript
// Template pattern à utiliser
describe('FactureService', () => {
  let service: FactureService;
  let prisma: PrismaService;
  
  beforeEach(() => {
    // Setup mocks
  });
  
  describe('create', () => {
    it('should create facture with valid data', () => {
      // Arrange
      const data = { ... };
      
      // Act
      const result = service.create(data);
      
      // Assert
      expect(result).toBeDefined();
    });
    
    it('should throw if stock insufficient', () => {
      // Test error case
    });
    
    it('should filter by centreId (multi-tenant)', () => {
      // Test isolation
    });
  });
});
```

**Frontend Components**
```typescript
// Template pattern
describe('FactureListComponent', () => {
  let component: FactureListComponent;
  let fixture: ComponentFixture<FactureListComponent>;
  let service: FactureService;
  
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ FactureListComponent ],
      providers: [ FactureService ]
    }).compileComponents();
  });
  
  it('should display factures', () => {
    // Test rendering
  });
  
  it('should handle API error', () => {
    // Test error handling
  });
});
```

**Requirements**:
- [ ] ≥ 80% line coverage
- [ ] ≥ 80% branch coverage
- [ ] All happy paths tested
- [ ] All error cases tested
- [ ] Multi-tenant isolation tested

---

### 2️⃣ Integration Tests (Features + API)

**Backend Integration**
```typescript
describe('Facture Creation Flow (Integration)', () => {
  it('should create facture → update stock → calculate points', async () => {
    // Test complete flow in transaction
    // Verify all side effects
    // Verify atomicity
  });
  
  it('should isolate data between centres', async () => {
    // Create in centre A
    // Verify centre B cannot see
  });
  
  it('should rollback on error', async () => {
    // Trigger error mid-transaction
    // Verify state not partially changed
  });
});
```

**Frontend API Integration**
```typescript
describe('Facture Creation Form (E2E Integration)', () => {
  it('should submit form → call API → update UI', async () => {
    // Fill form
    // Submit
    // Verify API called
    // Verify success message
    // Verify table updated
  });
  
  it('should handle API error gracefully', async () => {
    // API returns 400
    // Verify error message shown
    // Form not cleared
  });
});
```

**Requirements**:
- [ ] All modules interaction tested
- [ ] API contracts verified
- [ ] Error scenarios covered
- [ ] Multi-tenant flow tested

---

### 3️⃣ Business Logic Tests

**Specific to rules in SPECIFICATION_FINALE section 5**

```typescript
describe('Loyalty Points Calculation', () => {
  it('should add 0.1 points per DH', () => {
    const points = calculatePoints(1000);
    expect(points).toBe(100);
  });
  
  it('should include bonus for new client', () => {
    const points = calculatePoints(500, { isNewClient: true });
    expect(points).toBe(70); // 50 + (500 * 0.1)
  });
  
  it('should handle referral bonus', () => {
    // +50 referrer, +20 referree
  });
  
  it('should not exceed limit', () => {
    // If applicable
  });
});

describe('Commission Calculation', () => {
  it('should calculate 5% for MONTURE', () => {
    const commission = calculateCommission(1000, 'MONTURE');
    expect(commission).toBe(50);
  });
  
  it('should calculate 2% for VERRE', () => {
    const commission = calculateCommission(1000, 'VERRE');
    expect(commission).toBe(20);
  });
  
  it('should only apply if facture PAYEE', () => {
    // DEVIS state → no commission
  });
});

describe('Stock Validation', () => {
  it('should block if quantity insufficient', () => {
    expect(() => validateStock(product, 100, 50))
      .toThrow('Stock insuffisant');
  });
  
  it('should allow exact quantity', () => {
    expect(validateStock(product, 50, 50)).toBe(true);
  });
});
```

**Requirements**:
- [ ] All rules from section 5 tested
- [ ] Edge cases covered
- [ ] Transitions tested (status machine)
- [ ] Calculations verified

---

### 4️⃣ Security Tests

**Multi-Tenant Isolation**
```typescript
describe('Multi-Tenant Isolation', () => {
  it('should not expose centre A data to centre B', async () => {
    // Create facture in centre A
    // Login as centre B user
    // Request factures
    // Verify empty or filtered
    expect(result).toEqual([]);
  });
  
  it('should filter queries by centreId', async () => {
    // Query builder includes: where { centreId: userCentreId }
    const query = service.getFactures(userCentreId);
    expect(query).toContainEqual('centreId');
  });
});
```

**Input Validation**
```typescript
describe('Input Validation Security', () => {
  it('should reject SQL injection', () => {
    const input = "1; DROP TABLE factures;--";
    expect(() => validateInput(input))
      .toThrow();
  });
  
  it('should reject XSS payload', () => {
    const input = "<img src=x onerror=alert('xss')>";
    expect(() => validateInput(input))
      .toThrow();
  });
  
  it('should sanitize output', () => {
    const output = sanitize("<b>Bold</b>");
    expect(output).not.toContain('<b>');
  });
});
```

**Permissions**
```typescript
describe('Role-Based Access Control', () => {
  it('should allow ADMIN', async () => {
    const user = { role: 'ADMIN' };
    expect(canAccess(user, 'DELETE_FACTURES')).toBe(true);
  });
  
  it('should deny VENDEUR DELETE', async () => {
    const user = { role: 'VENDEUR' };
    expect(canAccess(user, 'DELETE_FACTURES')).toBe(false);
  });
});
```

**Requirements**:
- [ ] Multi-tenant isolation verified
- [ ] SQL injection impossible
- [ ] XSS impossible
- [ ] RBAC enforced
- [ ] Audit trail logged

---

### 5️⃣ Performance Tests

```typescript
describe('Performance', () => {
  it('should list 1000 factures in < 200ms', async () => {
    const start = Date.now();
    await service.getFactures({ limit: 1000 });
    const duration = Date.now() - start;
    expect(duration).toBeLessThan(200);
  });
  
  it('should create facture with 50 items in < 500ms', async () => {
    const facture = createWithItems(50);
    const duration = measure(() => service.create(facture));
    expect(duration).toBeLessThan(500);
  });
});
```

**Requirements**:
- [ ] API endpoints < 200ms (p95)
- [ ] List endpoints < 500ms (1000 items)
- [ ] UI renders in < 100ms
- [ ] No N+1 queries
- [ ] Proper indexing

---

## 🧬 TEST COVERAGE TARGETS

| Component | Target | Status |
|-----------|--------|--------|
| Services | 85% | [ ] |
| Controllers | 80% | [ ] |
| Components | 80% | [ ] |
| Pipes/Guards | 90% | [ ] |
| Overall | 80%+ | [ ] |

Run coverage:
```bash
# Backend
npm run test -- --coverage

# Frontend
npm run test -- --code-coverage
```

---

## 🔄 TEST EXECUTION FLOW

### Before Pull Request
```bash
# 1. Run unit tests
npm run test

# 2. Check coverage
npm run test -- --coverage
# Verify ≥ 80%

# 3. Run linting
npm run lint

# 4. Build locally
npm run build
# Verify no errors

# 5. Manual testing (5 min)
# - Create test data
# - Test happy path
# - Test error path
# - Test edge case
```

### Before Deployment to Staging
```bash
# 1. All unit tests passing
✓ npm run test

# 2. All integration tests passing
✓ npm run test:integration

# 3. E2E tests passing
✓ npm run test:e2e

# 4. Coverage maintained
✓ npm run test -- --coverage

# 5. Manual QA in staging
✓ Smoke test feature
✓ Test cross-browser
✓ Test mobile responsive
```

### Before Production
```bash
# 1. All tests passing in CI/CD
✓ Pipeline green

# 2. Smoke tests on prod-like env
✓ Data setup correct
✓ Feature workflows

# 3. Rollback plan reviewed
✓ DB backup available
✓ Rollback script tested

# 4. Monitoring setup
✓ Alerts configured
✓ Dashboards ready
```

---

## 🐛 COMMON TEST MISTAKES

❌ **DON'T**:
- Skip multi-tenant tests
- Only test happy path
- Leave console.log in tests
- Use hardcoded IDs
- Test implementation not behavior
- Create brittle tests (too specific)

✅ **DO**:
- Test isolation between tenants
- Test all error paths
- Clean up test data
- Use test factories
- Test behavior not implementation
- Write maintainable tests

---

## 🚀 RUNNING TESTS

```bash
# Backend
cd backend

# Run all tests
npm run test

# Run specific test file
npm run test -- facture.service.spec

# Run with coverage
npm run test -- --coverage

# Watch mode (dev)
npm run test:watch

# Frontend
cd frontend

# Run all tests
npm run test

# Run specific component
npm run test -- --include='**/facture-list.component.spec'

# Coverage
npm run test -- --code-coverage

# Watch mode
npm run test:watch
```

---

## 📋 TEST CHECKLIST

- [ ] ≥ 80% coverage achieved
- [ ] All happy paths tested
- [ ] All error paths tested
- [ ] Multi-tenant isolation tested
- [ ] Security tests passing
- [ ] Performance tests passing
- [ ] Integration tests passing
- [ ] Business rules validated
- [ ] Edge cases covered
- [ ] No console.log/debugger
- [ ] Test data cleaned up
- [ ] All tests pass locally
- [ ] All tests pass in CI/CD

---

**Run tests often, test thoroughly! 🧪**
