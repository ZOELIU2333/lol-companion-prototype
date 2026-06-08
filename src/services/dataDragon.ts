export const DATA_DRAGON_VERSION = '16.11.1'

const DATA_DRAGON_CDN = 'https://ddragon.leagueoflegends.com/cdn'
const DATA_DRAGON_CDN_IMG = `${DATA_DRAGON_CDN}/img`
const DATA_DRAGON_LOCALE = 'zh_CN'
const CHAMPION_ICON_KEYS: Record<string, string> = {
  ahri: 'Ahri',
  akali: 'Akali',
  ambessa: 'Ambessa',
  annie: 'Annie',
  aphelios: 'Aphelios',
  ashe: 'Ashe',
  azir: 'Azir',
  belveth: 'Belveth',
  braum: 'Braum',
  caitlyn: 'Caitlyn',
  camille: 'Camille',
  corki: 'Corki',
  darius: 'Darius',
  diana: 'Diana',
  draven: 'Draven',
  ekko: 'Ekko',
  ezreal: 'Ezreal',
  fiddlesticks: 'Fiddlesticks',
  fizz: 'Fizz',
  gangplank: 'Gangplank',
  garen: 'Garen',
  illaoi: 'Illaoi',
  ivern: 'Ivern',
  jax: 'Jax',
  jhin: 'Jhin',
  jinx: 'Jinx',
  kaisa: 'Kaisa',
  karma: 'Karma',
  katarina: 'Katarina',
  leesin: 'LeeSin',
  leona: 'Leona',
  lissandra: 'Lissandra',
  lulu: 'Lulu',
  malzahar: 'Malzahar',
  mel: 'Mel',
  mordekaiser: 'Mordekaiser',
  naafiri: 'Naafiri',
  nautilus: 'Nautilus',
  nilah: 'Nilah',
  olaf: 'Olaf',
  poppy: 'Poppy',
  quinn: 'Quinn',
  reksai: 'RekSai',
  rell: 'Rell',
  renekton: 'Renekton',
  samira: 'Samira',
  seraphine: 'Seraphine',
  sett: 'Sett',
  shen: 'Shen',
  skarner: 'Skarner',
  smolder: 'Smolder',
  soraka: 'Soraka',
  syndra: 'Syndra',
  taric: 'Taric',
  teemo: 'Teemo',
  thresh: 'Thresh',
  tristana: 'Tristana',
  varus: 'Varus',
  vayne: 'Vayne',
  yasuo: 'Yasuo',
  yone: 'Yone',
  yuumi: 'Yuumi',
  yunara: 'Yunara',
  zed: 'Zed',
  zyra: 'Zyra',
  '1': 'Annie',
  '16': 'Soraka',
  '17': 'Teemo',
  '22': 'Ashe',
  '24': 'Jax',
  '42': 'Corki',
  '43': 'Karma',
  '55': 'Katarina',
  '58': 'Renekton',
  '67': 'Vayne',
  '81': 'Ezreal',
  '84': 'Akali',
  '86': 'Garen',
  '89': 'Leona',
  '90': 'Malzahar',
  '101': 'Xerath',
  '103': 'Ahri',
  '105': 'Fizz',
  '111': 'Nautilus',
  '117': 'Lulu',
  '122': 'Darius',
  '127': 'Lissandra',
  '133': 'Quinn',
  '134': 'Syndra',
  '143': 'Zyra',
  '145': 'Kaisa',
  '147': 'Seraphine',
  '200': 'Belveth',
  '201': 'Braum',
  '202': 'Jhin',
  '222': 'Jinx',
  '238': 'Zed',
  '268': 'Azir',
  '350': 'Yuumi',
  '360': 'Samira',
  '420': 'Illaoi',
  '421': 'RekSai',
  '427': 'Ivern',
  '523': 'Aphelios',
  '526': 'Rell',
  '777': 'Yone',
  '799': 'Ambessa',
  '800': 'Mel',
  '804': 'Yunara',
  '875': 'Sett',
  '895': 'Nilah',
  '901': 'Smolder',
  '950': 'Naafiri',
}

export type DataDragonHost = {
  fetchJson: <T>(url: string) => Promise<T | null>
}

export type DataDragonItemRecord = {
  id: string
  name: string
  description: string
  plaintext: string
  iconUrl: string
  tags: string[]
  gold: {
    total: number
    sell: number
  }
}

export type DataDragonChampionRecord = {
  id: string
  key: string
  name: string
  title: string
  iconUrl: string
  tags: string[]
}

export type DataDragonRuneRecord = {
  id: number
  key: string
  name: string
  iconUrl: string
  tree: string
}

type ItemDto = {
  data: Record<
    string,
    {
      name: string
      description: string
      plaintext?: string
      image: {
        full: string
      }
      tags?: string[]
      gold: {
        total: number
        sell: number
      }
    }
  >
}

type ChampionDto = {
  data: Record<
    string,
    {
      id: string
      key: string
      name: string
      title: string
      image: {
        full: string
      }
      tags: string[]
    }
  >
}

type RuneStyleDto = {
  id: number
  key: string
  name: string
  icon: string
  slots: {
    runes: {
      id: number
      key: string
      name: string
      icon: string
    }[]
  }[]
}

export function getItemIconUrl(iconId: number, version = DATA_DRAGON_VERSION) {
  return `${DATA_DRAGON_CDN}/${version}/img/item/${iconId}.png`
}

export function getRuneIconUrl(iconPath: string) {
  return `${DATA_DRAGON_CDN_IMG}/${iconPath}`
}

export function getChampionIconUrl(championId: string, version = DATA_DRAGON_VERSION) {
  const iconKey = CHAMPION_ICON_KEYS[championId.toLowerCase()] ?? championId
  return `${DATA_DRAGON_CDN}/${version}/img/champion/${iconKey}.png`
}

export function getVersionLabel() {
  return DATA_DRAGON_VERSION.split('.').slice(0, 2).join('.')
}

export function getDataDragonAssetUrl(version: string, path: string) {
  return `${DATA_DRAGON_CDN}/${version}/data/${DATA_DRAGON_LOCALE}/${path}`
}

export function createDataDragonCatalog(host: DataDragonHost) {
  async function getLatestVersion() {
    const versions = await host.fetchJson<string[]>('https://ddragon.leagueoflegends.com/api/versions.json')
    return versions?.[0] ?? DATA_DRAGON_VERSION
  }

  return {
    getLatestVersion,

    async getItems(version?: string): Promise<DataDragonItemRecord[]> {
      const resolvedVersion = version ?? (await getLatestVersion())
      const payload = await host.fetchJson<ItemDto>(getDataDragonAssetUrl(resolvedVersion, 'item.json'))
      if (!payload) return []

      return Object.entries(payload.data).map(([id, item]) => ({
        id,
        name: item.name,
        description: item.description,
        plaintext: item.plaintext ?? '',
        iconUrl: `${DATA_DRAGON_CDN}/${resolvedVersion}/img/item/${item.image.full}`,
        tags: item.tags ?? [],
        gold: item.gold,
      }))
    },

    async getChampions(version?: string): Promise<DataDragonChampionRecord[]> {
      const resolvedVersion = version ?? (await getLatestVersion())
      const payload = await host.fetchJson<ChampionDto>(getDataDragonAssetUrl(resolvedVersion, 'champion.json'))
      if (!payload) return []

      return Object.values(payload.data).map((champion) => ({
        id: champion.id,
        key: champion.key,
        name: champion.name,
        title: champion.title,
        iconUrl: `${DATA_DRAGON_CDN}/${resolvedVersion}/img/champion/${champion.image.full}`,
        tags: champion.tags,
      }))
    },

    async getRunes(version?: string): Promise<DataDragonRuneRecord[]> {
      const resolvedVersion = version ?? (await getLatestVersion())
      const payload = await host.fetchJson<RuneStyleDto[]>(getDataDragonAssetUrl(resolvedVersion, 'runesReforged.json'))
      if (!payload) return []

      return payload.flatMap((style) =>
        style.slots.flatMap((slot) =>
          slot.runes.map((rune) => ({
            id: rune.id,
            key: rune.key,
            name: rune.name,
            iconUrl: getRuneIconUrl(rune.icon),
            tree: style.name,
          })),
        ),
      )
    },
  }
}
