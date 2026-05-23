import { Test, TestingModule } from '@nestjs/testing';
import { BanqueService } from './banque.service';

describe('BanqueService', () => {
  let service: BanqueService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [BanqueService],
    }).compile();

    service = module.get<BanqueService>(BanqueService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
