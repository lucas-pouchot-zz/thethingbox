#!/bin/bash

SSID_ID="AP"

if test $# -eq 1
then
	SSID_ID="$1"
fi

init(){
	systemctl enable hostapd > /dev/null 2>&1
	systemctl enable dnsmasq > /dev/null 2>&1
	service hostapd stop > /dev/null 2>&1
	service dnsmasq stop > /dev/null 2>&1
}

deny_interface_wlan(){
	DENYWLAN=`sed -n '/^denyinterfaces wlan0/=' /etc/dhcpcd.conf`
	DENYWLAN_COMMENT=`sed -n '/^#[ ]*denyinterfaces wlan0/=' /etc/dhcpcd.conf`
	if test "" = "$DENYWLAN"
	then
		if test "" = "$DENYWLAN_COMMENT"
		then
			echo "denyinterfaces wlan0" >> /etc/dhcpcd.conf
		else
			sed -i 's/^#[ ]*denyinterfaces wlan0/denyinterfaces wlan0/' /etc/dhcpcd.conf
		fi
	fi
}

set_AP_interfacs(){
	if [ ! -e /etc/network/interfacesBAK ]
	then
		mv /etc/network/interfaces /etc/network/interfacesBAK
	fi

	echo "" > /etc/network/interfaces
    cat <<EOF > /etc/network/interfaces &
# interfaces(5) file used by ifup(8) and ifdown(8)

# Please note that this file is written to be used with dhcpcd
# For static IP, consult /etc/dhcpcd.conf and 'man dhcpcd.conf'

# Include files from /etc/network/interfaces.d:
source-directory /etc/network/interfaces.d

auto lo
iface lo inet loopback

allow-hotplug wlan0  
iface wlan0 inet static
    address 192.168.61.1
    netmask 255.255.255.0
    network 192.168.61.0
    broadcast 192.168.61.255

###eth0:
auto eth0
allow-hotplug eth0
iface eth0 inet dhcp
###:eth0

EOF
	ip addr flush dev wlan0
	service networking restart
	ifdown wlan0 > /dev/null 2>&1
	ifup wlan0
}

configure_hostapd(){
	echo "" > /etc/hostapd/hostapd.conf
    cat <<EOF > /etc/hostapd/hostapd.conf &
interface=wlan0
ssid=digitalairways_$SSID_ID
# mode Wi-Fi (a = IEEE 802.11a, b = IEEE 802.11b, g = IEEE 802.11g)
hw_mode=g
channel=6
# open Wi-Fi, no auth !
auth_algs=1
# Beacon interval in kus (1.024 ms)
beacon_int=100
# DTIM (delivery trafic information message)
dtim_period=2
# Maximum number of stations allowed in station table
max_num_sta=255
# RTS/CTS threshold; 2347 = disabled (default)
rts_threshold=2347
# Fragmentation threshold; 2346 = disabled (default)
fragm_threshold=2346

EOF

	DEMONCONF_COMMENT=`sed -n '/^#[ ]*DAEMON_CONF\=\"[\/a-zA-Z0-9\.]*\"/=' /etc/default/hostapd`

	if test "" != "$DEMONCONF_COMMENT"
	then
		sed -i 's/^#[ ]*DAEMON_CONF\=\"[\/a-zA-Z0-9\.]*\"/DAEMON_CONF\=\"\"/' /etc/default/hostapd
	fi
	sed -i 's/^DAEMON_CONF\=\"[\/a-zA-Z0-9\.]*\"/DAEMON_CONF\=\"\/etc\/hostapd\/hostapd\.conf\"/' /etc/default/hostapd
}

configure_dnsmasq(){	
	if [ ! -e /etc/dnsmasqBAK.conf ]
	then
		mv /etc/dnsmasq.conf /etc/dnsmasqBAK.conf
	fi

	echo "" > /etc/dnsmasq.conf
    cat <<EOF > /etc/dnsmasq.conf &
interface=wlan0 
listen-address=192.168.61.1
bind-interfaces
server=8.8.8.8
domain-needed
bogus-priv
dhcp-range=192.168.61.10,192.168.61.254,2h

EOF
}

ip_forwarding(){
	IPFORWARDING_COMMENT=`sed -n '/^#[ ]*net\.ipv4\.ip\_forward\=1/=' /etc/sysctl.conf`

	if test "" = "$IPFORWARDING_COMMENT"
	then
		sed -i 's/^#[ ]*net\.ipv4\.ip\_forward\=1/net\.ipv4\.ip\_forward\=1/' /etc/sysctl.conf
	fi

	IPFORWARDING=`sed -n '/^net\.ipv4\.ip\_forward\=1/=' /etc/sysctl.conf`

	if test "" = "$IPFORWARDING"
	then
		echo "net.ipv4.ip_forward=1" >> /etc/sysctl.conf
	fi

	echo 1 > /proc/sys/net/ipv4/ip_forward

	comment="digitalairwaysAPRules"

	iptables -t nat -A POSTROUTING -o eth0 -j MASQUERADE -m comment --comment "$comment"
	iptables -A FORWARD -i eth0 -o wlan0 -m state --state RELATED,ESTABLISHED -j ACCEPT -m comment --comment "$comment"
	iptables -A FORWARD -i wlan0 -o eth0 -j ACCEPT -m comment --comment "$comment"

	iptables -t mangle -N internet -m comment --comment "$comment"
	iptables -t mangle -A PREROUTING -i wlan0 -p tcp -m tcp --dport 80 -j internet -m comment --comment "$comment"
	iptables -t mangle -A internet -j MARK --set-mark 99 -m comment --comment "$comment"
	iptables -t nat -A PREROUTING -i wlan0 -p tcp -m mark --mark 99 -m tcp --dport 80  -j DNAT --to-destination 192.168.61.1 -m comment --comment "$comment"

	iptables-save >/etc/iptables/rules.v4
	ip6tables-save >/etc/iptables/rules.v6
}

restart_services(){
	service hostapd restart
	service dnsmasq restart
}

init
deny_interface_wlan
set_AP_interfacs
configure_hostapd
configure_dnsmasq
ip_forwarding
restart_services