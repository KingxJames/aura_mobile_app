import { StyleSheet } from 'react-native';

import { Text, View } from '@/components/Themed';

type Props = {
  path: string;
};

export default function EditScreenInfo({ path }: Props) {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Edit this screen:</Text>
      <View style={styles.codeHighlightContainer}>
        <Text style={styles.codeHighlightText}>{path}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    marginHorizontal: 24,
  },
  title: {
    fontSize: 17,
    lineHeight: 24,
    textAlign: 'center',
  },
  codeHighlightContainer: {
    borderRadius: 3,
    paddingHorizontal: 4,
    marginVertical: 8,
  },
  codeHighlightText: {
    fontSize: 14,
    fontFamily: 'SpaceMono',
  },
});
