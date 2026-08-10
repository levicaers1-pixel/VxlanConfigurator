import type { SectionBuilder } from '../context'

/**
 * Day-1 baseline config applied to every switch regardless of role: NTP,
 * remote syslog, an explicit local-AAA fallback statement, and an optional
 * login banner. Verified command syntax against Aruba's AOS-CX CLI Bank
 * (NTP_cmds/ntp-ser, RSyslog_cmds/log, Rem_AAA_cmds/aaa-aut-log, Banner_cmds/banner).
 */
export const baseline: SectionBuilder = (ctx, out) => {
  const { ntpServers, syslogServers, aaaLocalFallback, bannerText } = ctx.project.settings.baseline
  let wrote = false

  for (const server of ntpServers) {
    out.line(`ntp server ${server} iburst`)
    wrote = true
  }

  for (const server of syslogServers) {
    out.line(`logging ${server}`)
    wrote = true
  }

  if (aaaLocalFallback) {
    out.line('aaa authentication login default local')
    wrote = true
  }

  if (wrote) out.blank()

  if (bannerText) {
    out.line('banner motd ^')
    for (const textLine of bannerText.split('\n')) out.line(textLine)
    out.line('^')
    out.blank()
  }
}
