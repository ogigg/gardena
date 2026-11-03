import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { compassPoint, type GardenSunState } from '../../../domain/sun/sunPosition';
import {
  addDays,
  deviceTimezone,
  formatClock,
  formatOffset,
  offsetMinutesAt,
  parseDate,
  prettyDate,
  supportsIntlTimeZones,
  todayInZone,
  utcToZoned,
  zonedToUtc,
} from '../../../domain/sun/gardenTime';
import { Banner } from '../../../shared/ui/Banner';
import { Chip } from '../../../shared/ui/Chip';
import { IconButton } from '../../../shared/ui/IconButton';
import { ScrubBar } from '../../../shared/ui/ScrubBar';
import { colors, space, type } from '../../../shared/ui/theme';

const toMinutes = (v: number) => Math.min(1435, Math.round((v * 1440) / 5) * 5);

/** Date/time controls in garden time, sun readout and the "modelled, not measured" notice. */
export function SunPanel({
  timezone,
  date,
  minutes,
  sun,
  onDateChange,
  onMinutesChange,
  onMinutesCommit,
}: {
  timezone: string;
  date: string;
  minutes: number;
  sun: GardenSunState;
  onDateChange: (date: string) => void;
  onMinutesChange: (m: number) => void;
  onMinutesCommit: (m: number) => void;
}) {
  const tz = timezone;
  const phoneTz = deviceTimezone();
  const phoneTime = utcToZoned(phoneTz, sun.instant.utcMs);
  const gardenTime = utcToZoned(tz, sun.instant.utcMs);
  const year = parseDate(date).year;
  const janOffset = offsetMinutesAt(tz, zonedToUtc(tz, `${year}-01-15`, 720).utcMs);
  const isSummerTime = sun.instant.offsetMinutes !== janOffset;
  const presets = [
    { label: 'Today', date: todayInZone(tz).date },
    { label: '21 Mar', date: `${year}-03-21` },
    { label: '21 Jun', date: `${year}-06-21` },
    { label: '23 Sep', date: `${year}-09-23` },
    { label: '21 Dec', date: `${year}-12-21` },
  ];
  const markers = [
    ...(sun.sunriseMin !== null ? [{ at: sun.sunriseMin / 1440, label: '↑' + formatClock(sun.sunriseMin) }] : []),
    ...(sun.sunsetMin !== null ? [{ at: sun.sunsetMin / 1440, label: '↓' + formatClock(sun.sunsetMin) }] : []),
  ];

  return (
    <View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: space.m }}>
        {presets.map((p) => (
          <Chip key={p.label} label={p.label} active={date === p.date} onPress={() => onDateChange(p.date)} />
        ))}
      </ScrollView>
      <View style={styles.dateRow}>
        <IconButton glyph="‹" label="Previous day" onPress={() => onDateChange(addDays(date, -1))} />
        <Text style={[type.heading, { flex: 1, textAlign: 'center' }]}>{prettyDate(date)}</Text>
        <IconButton glyph="›" label="Next day" onPress={() => onDateChange(addDays(date, 1))} />
      </View>
      <ScrubBar
        value={minutes / 1440}
        markers={markers}
        onChange={(v) => onMinutesChange(toMinutes(v))}
        onCommit={(v) => onMinutesCommit(toMinutes(v))}
        step={15 / 1440}
        accessibilityLabel="Time of day in garden time"
        accessibilityValue={formatClock(minutes)}
      />
      <Text style={type.heading}>
        {formatClock(gardenTime.hour * 60 + gardenTime.minute)}{' '}
        <Text style={type.small}>
          garden time · {tz} ({formatOffset(sun.instant.offsetMinutes)}
          {isSummerTime ? ', summer time' : ''})
        </Text>
      </Text>
      {phoneTz !== tz ? (
        <Text style={type.small}>
          Your phone: {formatClock(phoneTime.hour * 60 + phoneTime.minute)} ({phoneTz})
        </Text>
      ) : null}
      {sun.instant.nonexistent ? (
        <Text style={[type.small, { color: colors.warn }]}>{formatClock(minutes)} is skipped by the clock change that day.</Text>
      ) : null}
      <Text style={[type.body, { marginTop: space.s }]}>
        {sun.isUp
          ? `Sun ${sun.position.altitudeDeg.toFixed(0)}° above the horizon, from the ${compassPoint(sun.position.azimuthDeg)} (${sun.position.azimuthDeg.toFixed(0)}°).`
          : sun.alwaysUp
            ? 'Midnight sun today.'
            : 'Sun below the horizon — no direct sunlight.'}
      </Text>
      {!supportsIntlTimeZones() ? (
        <Banner tone="warn" style={{ marginTop: space.s }}>
          This device cannot convert time zones; times are shown in UTC.
        </Banner>
      ) : null}
      <Banner tone="sun" style={{ marginTop: space.s }}>
        Modelled sunlight: sun geometry and the shapes in this scene only. Not measured — ignores weather, terrain and anything not
        modelled. Tree shadows are approximate.
      </Banner>
    </View>
  );
}

const styles = StyleSheet.create({
  dateRow: { flexDirection: 'row', alignItems: 'center', marginTop: space.s },
});
