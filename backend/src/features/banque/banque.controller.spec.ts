import { Test, TestingModule } from '@nestjs/testing';
import { BanqueController } from './banque.controller';

describe('BanqueController', () => {
  let controller: BanqueController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [BanqueController],
    }).compile();

    controller = module.get<BanqueController>(BanqueController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
