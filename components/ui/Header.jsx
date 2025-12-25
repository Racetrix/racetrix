import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { THEME } from '../../constants/theme';

export default function Header({ title, leftIcon, onLeftPress, rightContent }) {
    return (
        <View style={styles.header}>
            <TouchableOpacity onPress={onLeftPress} style={styles.headerBtn}>
                <Text style={styles.headerIcon}>{leftIcon}</Text>
            </TouchableOpacity>
            <Text style={styles.headerTitle}>{title}</Text>
            <View style={styles.headerRight}>{rightContent}</View>
        </View>
    );
}

const styles = StyleSheet.create({
    header: { height: 50, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 15, borderBottomWidth: 1, borderColor: THEME.border },
    headerTitle: { color: THEME.text, fontSize: 16, fontWeight: 'bold' },
    headerBtn: { padding: 10 },
    headerIcon: { color: THEME.primary, fontSize: 24 },
    headerRight: { width: 40, alignItems: 'flex-end' },
});