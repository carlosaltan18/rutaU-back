import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  decodeCursor,
  encodeCursor,
  type PaginationDto,
} from '../../common/pagination/pagination.dto.js';
import { Campus } from './entities/campus.entity.js';
import { University } from './entities/university.entity.js';
import { Zone } from './entities/zone.entity.js';
import type { ZoneQueryDto } from './dto/catalog-query.dto.js';

interface NameCursor extends Record<string, string> {
  name: string;
  id: string;
}

@Injectable()
export class CatalogService {
  constructor(
    @InjectRepository(University)
    private readonly universities: Repository<University>,
    @InjectRepository(Campus)
    private readonly campuses: Repository<Campus>,
    @InjectRepository(Zone)
    private readonly zones: Repository<Zone>,
  ) {}

  async listUniversities(query: PaginationDto) {
    const cursor = decodeCursor<NameCursor>(query.cursor);
    const builder = this.universities
      .createQueryBuilder('item')
      .where('item.active = true')
      .orderBy('item.name', 'ASC')
      .addOrderBy('item.id', 'ASC')
      .take(query.limit + 1);
    if (cursor) {
      builder.andWhere('(item.name, item.id) > (:name, :id)', cursor);
    }
    return this.toPage(await builder.getMany(), query.limit);
  }

  async listCampuses(universityId: string, query: PaginationDto) {
    const cursor = decodeCursor<NameCursor>(query.cursor);
    const builder = this.campuses
      .createQueryBuilder('item')
      .where('item.active = true')
      .andWhere('item.university_id = :universityId', { universityId })
      .orderBy('item.name', 'ASC')
      .addOrderBy('item.id', 'ASC')
      .take(query.limit + 1);
    if (cursor) builder.andWhere('(item.name, item.id) > (:name, :id)', cursor);
    return this.toPage(await builder.getMany(), query.limit);
  }

  async listZones(query: ZoneQueryDto) {
    const cursor = decodeCursor<NameCursor>(query.cursor);
    const builder = this.zones
      .createQueryBuilder('item')
      .where('item.active = true')
      .orderBy('item.name', 'ASC')
      .addOrderBy('item.id', 'ASC')
      .take(query.limit + 1);
    if (query.municipality) {
      builder.andWhere('lower(item.municipality) = lower(:municipality)', {
        municipality: query.municipality.trim(),
      });
    }
    if (query.query) {
      builder.andWhere(
        '(item.name ILIKE :search OR item.municipality ILIKE :search)',
        { search: `%${query.query.trim()}%` },
      );
    }
    if (cursor) builder.andWhere('(item.name, item.id) > (:name, :id)', cursor);
    return this.toPage(await builder.getMany(), query.limit);
  }

  private toPage<T extends { id: string; name: string }>(
    rows: T[],
    limit: number,
  ) {
    const hasMore = rows.length > limit;
    const items = rows.slice(0, limit);
    const last = items.at(-1);
    return {
      items,
      nextCursor:
        hasMore && last ? encodeCursor({ name: last.name, id: last.id }) : null,
    };
  }
}
