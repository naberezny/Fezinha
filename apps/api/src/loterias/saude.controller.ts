import { Controller, Get } from '@nestjs/common';
import { ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { SaudeDto } from '@sorteios/contratos';
import { LoteriasService } from './loterias.service';

@ApiTags('saude')
@Controller('saude')
export class SaudeController {
  constructor(private readonly loterias: LoteriasService) {}

  @Get()
  @ApiOkResponse({ type: SaudeDto })
  saude(): Promise<SaudeDto> {
    return this.loterias.saude();
  }
}
