import { Injectable } from '@nestjs/common'
import { Cron } from '@nestjs/schedule'
import 'isomorphic-fetch'
import { LoggerService } from '../../service/logger.service'
import { Immobilienscout24At } from './immobilienscout24.at'
import { Hit } from './list.query'

@Injectable()
export class Immobilienscout24AtAllJob {
  constructor(
    private readonly hitService: Immobilienscout24At,
    private readonly logger: LoggerService,
  ) {
    this.logger.setContext(this.constructor.name)
  }

  @Cron('0 0 2 * * *', {
    timeZone: 'Europe/Vienna',
  })
  public async execute(): Promise<boolean> {
    this.logger.log('extract all pages')

    const urls = [
      '/regional/burgenland/immobilie-kaufen',
      '/regional/niederoesterreich/immobilie-kaufen',
    ]

    const deleteBefore = new Date(Date.now() - 60000)

    for(const url of urls) {
      const result = await this.hitService.list(url)

      await this.processHits(result.getDataByURL.results.hits)

      const otherUrls = [...result.getDataByURL.results.pagination.all]
      otherUrls.shift()

      await this.processUrls(otherUrls)
    }

    // clean out all entries that are older than
    await this.hitService.deleteBefore(deleteBefore)

    return false
  }

  private async processHits(hits: Hit[]): Promise<void> {
    await Promise.all(
      hits
        .map(
          hit => this.hitService
            .process(hit)
            .catch(e => this.logger.catch(e, `failed to process expose ${hit.exposeId}`))
        )
    )
  }

  private async processUrls(urls: string[]): Promise<void> {
    for(const url of urls) {
      const result = await this.hitService.list(url)

      await this.processHits(result.getDataByURL.results.hits)
    }
  }
}
